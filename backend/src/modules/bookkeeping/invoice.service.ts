import { Types } from "mongoose";
import { Invoice, type InvoiceDoc } from "./invoice.model";
import { InvoiceCounter } from "./bookkeepingConfig.model";
import { getBookkeepingConfig } from "./bookkeepingConfig.service";
import { Booking, type BookingDocument } from "../booking/booking.model";
import { Payment } from "../payment/payment.model";
import { User } from "../user/user.model";
import { ApiError } from "../../shared/utils/ApiError";

const paise = (n: number) => Math.round(n * 100) / 100;

/**
 * Everything the customer owes on a booking: what was charged at checkout
 * (taxed), plus anything charged after it — a reschedule that reclaimed an
 * off-peak subsidy (raising `price` above the taxed amount) or a peak-upgrade
 * fee. Old bookings without a tax snapshot owe their price.
 */
export function bookingAmountDue(b: {
  price: number;
  taxableAmount?: number | null;
  payableAmount?: number | null;
  peakUpgradeFeeCharged?: number | null;
}): number {
  const checkout = b.payableAmount ?? b.price;
  const reclaimed = b.taxableAmount != null ? Math.max(0, b.price - b.taxableAmount) : 0;
  return paise(checkout + reclaimed + (b.peakUpgradeFeeCharged ?? 0));
}

/** Indian financial year (April–March) an instant falls in, in IST: "2026-27". */
export function financialYear(at: Date): string {
  const ist = new Date(at.getTime() + 5.5 * 60 * 60 * 1000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

async function nextInvoiceNumber(at: Date): Promise<{ number: string; fy: string }> {
  const fy = financialYear(at);
  const { invoice } = await getBookkeepingConfig();
  const counter = await InvoiceCounter.findOneAndUpdate({ _id: fy }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  const seq = String(counter!.seq).padStart(invoice.numberPadding ?? 5, "0");
  return { number: `${invoice.prefix || "INV"}/${fy}/${seq}`, fy };
}

type BookingLike = BookingDocument & { user?: unknown };

/** Money lines and totals for a booking, derived from its own snapshot — the booking is the source of truth. */
async function financialsFor(b: BookingLike, sac: string) {
  const discount = b.discountAmount ?? 0;
  const coins = b.coinDiscount ?? 0;
  const taxable = b.taxableAmount ?? b.price;
  const gross = paise(taxable + discount + coins);
  const lines: { description: string; sac: string; quantity: number; amount: number; kind: "service" | "discount" | "adjustment" }[] = [
    {
      description: b.isSubscriptionWash
        ? `${b.packageName} — ${b.vehicleName} (included in subscription)`
        : `${b.packageName} — ${b.vehicleName}`,
      sac,
      quantity: 1,
      amount: gross,
      kind: "service",
    },
  ];
  if (discount > 0) {
    lines.push({ description: `Discount${b.discountCode ? ` (${b.discountCode})` : ""}`, sac: "", quantity: 1, amount: -discount, kind: "discount" });
  }
  if (coins > 0) {
    lines.push({ description: `NexClean coins redeemed (${b.coinsRedeemed ?? 0})`, sac: "", quantity: 1, amount: -coins, kind: "discount" });
  }
  const reclaimed = b.taxableAmount != null ? Math.max(0, paise(b.price - b.taxableAmount)) : 0;
  if (reclaimed > 0) {
    lines.push({ description: "Off-peak discount reclaimed on reschedule", sac: "", quantity: 1, amount: reclaimed, kind: "adjustment" });
  }
  if ((b.peakUpgradeFeeCharged ?? 0) > 0) {
    lines.push({ description: "Peak-slot upgrade fee", sac: "", quantity: 1, amount: b.peakUpgradeFeeCharged!, kind: "adjustment" });
  }
  const adjustmentTotal = paise(reclaimed + (b.peakUpgradeFeeCharged ?? 0));

  const paid = await Payment.find({ booking: b._id, status: "paid" }).select("amount paymentId orderId kind").lean();
  const amountPaid = paise(paid.reduce((s, p) => s + (p.amount ?? 0), 0));
  const paymentMethod = b.isSubscriptionWash
    ? "Subscription"
    : paid.some((p) => p.paymentId)
      ? "Online"
      : paid.length > 0
        ? "Cash"
        : "";

  return {
    lines,
    subtotal: gross,
    discountTotal: paise(discount + coins),
    taxableAmount: taxable,
    taxRate: b.taxRate ?? 0,
    supplyType: (b.taxSupplyType ?? "intra") as "intra" | "inter",
    cgstAmount: b.cgstAmount ?? 0,
    sgstAmount: b.sgstAmount ?? 0,
    igstAmount: b.igstAmount ?? 0,
    taxAmount: b.taxAmount ?? 0,
    adjustmentTotal,
    roundOff: b.taxRoundOff ?? 0,
    total: bookingAmountDue(b),
    amountPaid,
    paymentMethod,
    status: (b.status === "cancelled"
      ? "cancelled"
      : b.status === "completed" || (amountPaid > 0 && amountPaid >= bookingAmountDue(b))
        ? "paid"
        : "issued") as "issued" | "paid" | "cancelled",
  };
}

function serviceSnapshot(b: BookingLike) {
  return {
    packageName: b.packageName,
    vehicleName: b.vehicleName,
    vehicleType: b.vehicleType,
    vehiclePlate: b.vehiclePlate ?? "",
    date: b.date,
    slot: b.slot,
    address: `${b.addressLabel} — ${b.addressLine}`,
    cleanerName: b.agentName ?? "",
    isSubscriptionWash: !!b.isSubscriptionWash,
  };
}

/**
 * Issue the booking's invoice if it has none, otherwise bring its figures,
 * status and service details up to date with the booking. Admin edits to the
 * bill-to block, notes and line wording are kept.
 */
export async function ensureInvoiceForBooking(bookingId: string): Promise<InvoiceDoc> {
  if (!Types.ObjectId.isValid(bookingId)) throw ApiError.notFound("Booking not found");
  const booking = (await Booking.findById(bookingId)) as BookingLike | null;
  if (!booking) throw ApiError.notFound("Booking not found");
  const config = await getBookkeepingConfig();
  const fin = await financialsFor(booking, config.tax.sacCode);

  const existing = await Invoice.findOne({ booking: booking._id });
  if (existing) {
    // Keep admin-reworded lines when the set of lines hasn't changed shape.
    const sameShape =
      existing.lines.length === fin.lines.length && existing.lines.every((l, i) => l.kind === fin.lines[i].kind);
    const lines = existing.revision > 0 && sameShape
      ? fin.lines.map((l, i) => ({ ...l, description: existing.lines[i].description, sac: existing.lines[i].sac ?? l.sac }))
      : fin.lines;
    existing.set({ ...fin, lines, service: serviceSnapshot(booking) });
    if (existing.isModified()) await existing.save();
    return existing.invoiceNumber ? existing : awaitNumber(existing, existing.issuedAt ?? new Date());
  }

  const customer = await User.findById(booking.user).select("name phone email").lean();
  const issuedAt = booking.get("createdAt") ?? new Date();
  const { business, tax } = config;
  // Create the record first, numberless, with an upsert keyed on the booking.
  // Exactly one caller can be the one that inserted it, and only that caller
  // takes a number — two racing requests can no longer each burn one, which
  // would leave a gap in the GST invoice series.
  let res;
  try {
    res = await Invoice.findOneAndUpdate(
      { booking: booking._id },
      {
        $setOnInsert: {
          booking: booking._id,
          customer: booking.user,
          invoiceNumber: null,
          financialYear: financialYear(issuedAt),
          issuedAt,
          billTo: {
            name: customer?.name ?? "",
            phone: customer?.phone ?? "",
            email: customer?.email ?? "",
            address: booking.addressLine,
            gstin: "",
          },
          seller: { ...business },
          taxLabel: tax.label,
          service: serviceSnapshot(booking),
          ...fin,
        },
      },
      { upsert: true, new: true, includeResultMetadata: true },
    );
  } catch (err) {
    // Concurrent upserts on a unique key: the loser gets E11000 — the record exists now.
    if ((err as { code?: number }).code !== 11000) throw err;
    const winner = await Invoice.findOne({ booking: booking._id });
    if (!winner) throw err;
    return awaitNumber(winner, issuedAt);
  }
  const doc = res.value!;
  if (res.lastErrorObject?.updatedExisting) return awaitNumber(doc, issuedAt);
  return assignNumber(doc._id, issuedAt);
}

async function assignNumber(id: unknown, issuedAt: Date): Promise<InvoiceDoc> {
  const { number, fy } = await nextInvoiceNumber(issuedAt);
  const numbered = await Invoice.findOneAndUpdate(
    { _id: id, invoiceNumber: null },
    { $set: { invoiceNumber: number, financialYear: fy } },
    { new: true },
  );
  return numbered ?? (await Invoice.findById(id))!;
}

/**
 * Another request created this invoice and is assigning its number; wait for
 * it. If that request died between creating and numbering, finish the job —
 * claimed with a compare-and-set so only one rescuer takes a number.
 */
async function awaitNumber(doc: InvoiceDoc, issuedAt: Date): Promise<InvoiceDoc> {
  let current: InvoiceDoc | null = doc;
  for (let i = 0; i < 30 && current && !current.invoiceNumber; i++) {
    await new Promise((r) => setTimeout(r, 100));
    current = await Invoice.findById(doc._id);
  }
  if (!current) throw ApiError.notFound("Invoice not found");
  if (current.invoiceNumber) return current;
  const claimed = await Invoice.findOneAndUpdate(
    { _id: doc._id, invoiceNumber: null, numberRecoveredAt: null },
    { $set: { numberRecoveredAt: new Date() } },
    { new: true },
  );
  if (claimed) return assignNumber(doc._id, issuedAt);
  return awaitNumber(current, issuedAt);
}

/** Fire-and-forget refresh after a booking changes (cancel, complete, reschedule). */
export function refreshInvoice(bookingId: string): void {
  void Invoice.exists({ booking: bookingId })
    .then((has) => (has ? ensureInvoiceForBooking(bookingId) : null))
    .catch((err) => console.error("invoice refresh failed:", (err as Error).message));
}

/** The invoice for one of the customer's own bookings, plus the layout to render it with. */
export async function getCustomerInvoice(customerId: string, bookingId: string) {
  if (!Types.ObjectId.isValid(bookingId)) throw ApiError.notFound("Booking not found");
  const owned = await Booking.exists({ _id: bookingId, user: customerId });
  if (!owned) throw ApiError.notFound("Booking not found");
  const invoice = await ensureInvoiceForBooking(bookingId);
  const { template } = await getBookkeepingConfig();
  return { invoice: invoice.toJSON(), template };
}

export async function getAdminInvoice(id: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Invoice not found");
  const found = await Invoice.findById(id).select("booking");
  if (!found) throw ApiError.notFound("Invoice not found");
  const invoice = await ensureInvoiceForBooking(String(found.booking));
  const { template } = await getBookkeepingConfig();
  return { invoice: invoice.toJSON(), template };
}

/** The invoice for a booking, issuing it if needed — admin booking detail. */
export async function getAdminInvoiceForBooking(bookingId: string) {
  const invoice = await ensureInvoiceForBooking(bookingId);
  const { template } = await getBookkeepingConfig();
  return { invoice: invoice.toJSON(), template };
}

export async function listInvoices(opts: { page: number; limit: number; status?: string; q?: string; from?: Date; to?: Date }) {
  const filter: Record<string, unknown> = { invoiceNumber: { $type: "string" } };
  if (opts.status && opts.status !== "all") filter.status = opts.status;
  if (opts.from || opts.to) {
    filter.issuedAt = { ...(opts.from ? { $gte: opts.from } : {}), ...(opts.to ? { $lte: opts.to } : {}) };
  }
  if (opts.q?.trim()) {
    const rx = new RegExp(opts.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ invoiceNumber: rx }, { "billTo.name": rx }, { "billTo.phone": rx }, { "service.packageName": rx }];
  }
  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .sort({ issuedAt: -1, _id: -1 })
      .skip((opts.page - 1) * opts.limit)
      .limit(opts.limit),
    Invoice.countDocuments(filter),
  ]);
  return {
    items: items.map((i) => i.toJSON()),
    page: opts.page,
    limit: opts.limit,
    total,
    hasMore: (opts.page - 1) * opts.limit + items.length < total,
  };
}

/**
 * Admin edits to an invoice. Money is never edited here — it always follows
 * the booking (change the booking, and the invoice follows). What an admin
 * can change is what a customer typically asks to be corrected: the bill-to
 * name, address and GSTIN, the line wording/SAC, and the notes.
 */
export async function updateInvoice(
  id: string,
  patch: {
    billTo?: Partial<Record<"name" | "phone" | "email" | "address" | "gstin", string>>;
    notes?: string;
    lines?: { index: number; description?: string; sac?: string }[];
  },
  editedBy: string,
) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Invoice not found");
  const invoice = await Invoice.findById(id);
  if (!invoice) throw ApiError.notFound("Invoice not found");
  if (patch.billTo) {
    for (const [k, v] of Object.entries(patch.billTo)) {
      if (v !== undefined) invoice.set(`billTo.${k}`, k === "gstin" ? v.toUpperCase() : v);
    }
  }
  if (patch.notes !== undefined) invoice.notes = patch.notes;
  for (const l of patch.lines ?? []) {
    const line = invoice.lines[l.index];
    if (!line) throw ApiError.badRequest(`Invoice has no line ${l.index + 1}`);
    if (l.description !== undefined) line.description = l.description;
    if (l.sac !== undefined) line.sac = l.sac;
  }
  invoice.revision = (invoice.revision ?? 0) + 1;
  invoice.editedAt = new Date();
  invoice.editedBy = editedBy;
  await invoice.save();
  return getAdminInvoice(id);
}

/** Totals for the Bookkeeping overview, over bookings created in [from, to]. */
export async function getBookkeepingSummary(from: Date, to: Date) {
  const match = { createdAt: { $gte: from, $lte: to } };
  const [byStatus] = await Booking.aggregate<{
    count: number;
    gross: number;
    discounts: number;
    coins: number;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    tax: number;
    roundOff: number;
    payable: number;
    adjustments: number;
    payouts: number;
  }>([
    { $match: { ...match, status: { $ne: "cancelled" } } },
    {
      $project: {
        taxable: { $ifNull: ["$taxableAmount", "$price"] },
        discountAmount: { $ifNull: ["$discountAmount", 0] },
        coinDiscount: { $ifNull: ["$coinDiscount", 0] },
        cgstAmount: { $ifNull: ["$cgstAmount", 0] },
        sgstAmount: { $ifNull: ["$sgstAmount", 0] },
        igstAmount: { $ifNull: ["$igstAmount", 0] },
        taxAmount: { $ifNull: ["$taxAmount", 0] },
        taxRoundOff: { $ifNull: ["$taxRoundOff", 0] },
        payable: { $ifNull: ["$payableAmount", "$price"] },
        adjustments: {
          $add: [
            { $ifNull: ["$peakUpgradeFeeCharged", 0] },
            {
              $cond: [
                { $ne: [{ $ifNull: ["$taxableAmount", null] }, null] },
                { $max: [0, { $subtract: ["$price", "$taxableAmount"] }] },
                0,
              ],
            },
          ],
        },
        payout: { $cond: [{ $eq: ["$status", "completed"] }, { $ifNull: ["$agentPayout", 0] }, 0] },
      },
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        gross: { $sum: { $add: ["$taxable", "$discountAmount", "$coinDiscount"] } },
        discounts: { $sum: "$discountAmount" },
        coins: { $sum: "$coinDiscount" },
        taxable: { $sum: "$taxable" },
        cgst: { $sum: "$cgstAmount" },
        sgst: { $sum: "$sgstAmount" },
        igst: { $sum: "$igstAmount" },
        tax: { $sum: "$taxAmount" },
        roundOff: { $sum: "$taxRoundOff" },
        payable: { $sum: "$payable" },
        adjustments: { $sum: "$adjustments" },
        payouts: { $sum: "$payout" },
      },
    },
  ]);
  const [refunds] = await Payment.aggregate<{ total: number }>([
    { $match: { status: "refunded", updatedAt: { $gte: from, $lte: to } } },
    { $group: { _id: null, total: { $sum: { $ifNull: ["$refundAmount", "$amount"] } } } },
  ]);
  const cancelled = await Booking.countDocuments({ ...match, status: "cancelled" });
  const s = byStatus ?? {
    count: 0, gross: 0, discounts: 0, coins: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, roundOff: 0, payable: 0, adjustments: 0, payouts: 0,
  };
  const r = (n: number) => paise(n);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    bookings: s.count,
    cancelledBookings: cancelled,
    grossServiceValue: r(s.gross),
    discounts: r(s.discounts),
    coinDiscounts: r(s.coins),
    taxableValue: r(s.taxable),
    cgst: r(s.cgst),
    sgst: r(s.sgst),
    igst: r(s.igst),
    taxCollected: r(s.tax),
    roundOff: r(s.roundOff),
    adjustments: r(s.adjustments),
    totalBilled: r(s.payable + s.adjustments),
    cleanerPayouts: r(s.payouts),
    refunds: r(refunds?.total ?? 0),
    // What the platform keeps from service value once cleaners are paid (GST is owed to the government, not kept).
    platformNet: r(s.taxable + s.adjustments - s.payouts),
  };
}
