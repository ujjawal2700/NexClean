import { Types } from "mongoose";
import { Booking } from "../booking/booking.model";
import { Payment } from "../payment/payment.model";
import { nonRefundablePortion } from "../payment/ledger.service";
import { createRazorpayRefund, paymentsLive } from "../payment/razorpay";
import { creditCoins } from "../wallet/wallet.service";
import { notifyUser } from "../notification/notification.service";
import { ApiError } from "../../shared/utils/ApiError";
import { RefundRequest, type RefundStatus } from "./refundRequest.model";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const coinsLabel = (n: number) => `${n.toLocaleString("en-IN")} coin${n === 1 ? "" : "s"}`;

/** "₹100 to your original payment method and 100 coins to your wallet" */
function describe(amount: number, coins: number): string {
  const parts: string[] = [];
  if (amount > 0) parts.push(`${rupees(amount)} to your original payment method`);
  if (coins > 0) parts.push(`${coinsLabel(coins)} to your wallet`);
  return parts.join(" and ");
}

/**
 * Called whenever a booking is cancelled (by the customer or an admin). Works
 * out what the customer actually paid for it and queues that as a refund for
 * an admin to approve — nothing is returned automatically.
 *
 * Counted: online payments for the booking (and any reschedule upcharge, less
 * its non-refundable change fee), and coins redeemed on it. Not counted: cash
 * that was never collected (a cancelled job's cash row is still "created"),
 * and anything an admin already refunded by hand from Payments.
 *
 * Safe to call twice — there is one request per booking.
 */
export async function queueCancellationRefund(
  bookingId: string,
  cancelledBy: "customer" | "admin",
  opts: { notify?: boolean } = {},
) {
  const booking = await Booking.findById(bookingId).select("user coinsRedeemed packageName peakUpgradeFeeCharged");
  if (!booking) return null;

  // "mock" rows are online payments taken while the gateway is in test mode.
  const payments = await Payment.find({
    booking: booking._id,
    kind: { $in: ["booking", "reschedule"] },
    status: { $in: ["paid", "mock"] },
  }).populate("booking", "peakUpgradeFeeCharged");

  const lines = payments
    .map((p) => ({
      payment: p._id,
      amount: Math.max(0, p.amount - nonRefundablePortion(p) - (p.refundAmount ?? 0)),
    }))
    .filter((l) => l.amount > 0);
  const amount = lines.reduce((s, l) => s + l.amount, 0);
  const coins = Math.max(0, booking.coinsRedeemed ?? 0);
  if (amount <= 0 && coins <= 0) return null;

  let request;
  try {
    request = await RefundRequest.create({
      booking: booking._id,
      user: booking.user,
      cancelledBy,
      lines,
      amount,
      coins,
    });
  } catch (err) {
    // Already queued for this booking.
    if ((err as { code?: number }).code === 11000) return RefundRequest.findOne({ booking: booking._id });
    throw err;
  }

  if (opts.notify === false) return request;
  void notifyUser(String(booking.user), {
    type: "booking",
    title: "💸 Refund under review",
    body: `We're reviewing a refund of ${describe(amount, coins)} for your cancelled ${booking.packageName}.`,
    data: { bookingId: String(booking._id), url: `/app/track/${booking._id}` },
  }).catch((err) => console.error("refund notify failed:", (err as Error).message));

  return request;
}

/**
 * Bookings cancelled before refund requests existed, whose online payment was
 * never refunded. The old Refunds screen derived its list from exactly these;
 * queue them once so nothing owed drops off the screen. Customers aren't
 * messaged about these — they were cancelled long ago.
 */
let backfilled = false;
async function backfillLegacyRefunds(): Promise<void> {
  if (backfilled) return;
  backfilled = true;
  const owed = await Payment.find({ kind: { $in: ["booking", "reschedule"] }, status: "paid", booking: { $ne: null } })
    .populate("booking", "status")
    .select("booking")
    .lean();
  const bookingIds = [
    ...new Set(
      owed
        .filter((p) => (p.booking as unknown as { status?: string } | null)?.status === "cancelled")
        .map((p) => String((p.booking as unknown as { _id: unknown })._id)),
    ),
  ];
  if (bookingIds.length === 0) return;
  const queued = new Set(
    (await RefundRequest.find({ booking: { $in: bookingIds } }).select("booking").lean()).map((r) => String(r.booking)),
  );
  for (const id of bookingIds.filter((b) => !queued.has(b))) {
    await queueCancellationRefund(id, "admin", { notify: false }).catch((err) =>
      console.error("legacy refund backfill failed:", (err as Error).message),
    );
  }
}

export async function listRefunds(status?: RefundStatus) {
  await backfillLegacyRefunds().catch((err) => {
    backfilled = false;
    console.error("legacy refund backfill failed:", (err as Error).message);
  });
  const rows = await RefundRequest.find(status ? { status } : {})
    .populate("user", "name phone")
    .populate("booking", "packageName vehicleName date slot price")
    .populate("lines.payment", "orderId paymentId amount status")
    .sort({ createdAt: -1 })
    .limit(300)
    .lean();
  return rows.map((r) => {
    const user = r.user as unknown as { _id?: unknown; name?: string; phone?: string } | null;
    const booking = r.booking as unknown as {
      _id?: unknown;
      packageName?: string;
      vehicleName?: string;
      date?: Date;
      slot?: string;
      price?: number;
    } | null;
    return {
      id: String(r._id),
      status: r.status,
      cancelledBy: r.cancelledBy,
      payments: r.lines.map((l) => {
        const p = l.payment as unknown as { _id?: unknown; orderId?: string; paymentId?: string | null } | null;
        return { id: p?._id ? String(p._id) : "", orderId: p?.orderId ?? "", paymentId: p?.paymentId ?? null, amount: l.amount };
      }),
      amount: r.amount,
      coins: r.coins,
      note: r.note,
      lastError: r.lastError,
      createdAt: r.createdAt,
      decidedAt: r.decidedAt,
      customer: { id: user?._id ? String(user._id) : null, name: user?.name || "Customer", phone: user?.phone ?? "" },
      booking: booking
        ? {
            id: String(booking._id),
            packageName: booking.packageName ?? "",
            vehicleName: booking.vehicleName ?? "",
            date: booking.date ?? null,
            slot: booking.slot ?? "",
          }
        : null,
    };
  });
}

/**
 * Send the refund: each online payment back to its original method through
 * Razorpay, and the coins back to the wallet. Each payment is marked refunded
 * as soon as the gateway accepts it, so if a later one fails the admin can
 * retry without refunding the earlier ones twice. Coins go back only once all
 * the money has.
 */
export async function approveRefund(id: string, adminId: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Refund not found");
  // Claim it, so a double click (or two admins) can't send it twice.
  const request = await RefundRequest.findOneAndUpdate(
    { _id: id, status: "pending" },
    { $set: { status: "processing", lastError: "" } },
    { new: true },
  );
  if (!request) {
    const existing = await RefundRequest.findById(id).select("status");
    if (!existing) throw ApiError.notFound("Refund not found");
    throw ApiError.badRequest(`This refund is already ${existing.status}`);
  }

  try {
    for (const line of request.lines) {
      const payment = await Payment.findById(line.payment);
      if (!payment || payment.status === "refunded") continue; // refunded by hand already
      if (paymentsLive && payment.paymentId && !payment.paymentId.startsWith("cash_")) {
        await createRazorpayRefund(payment.paymentId, line.amount);
      }
      payment.status = "refunded";
      payment.refundAmount = line.amount;
      payment.refundedAt = new Date();
      payment.refundReason = "Booking cancelled";
      await payment.save();
    }
  } catch (err) {
    const message = describeGatewayError(err);
    await RefundRequest.updateOne({ _id: request._id }, { $set: { status: "pending", lastError: message } });
    throw ApiError.badRequest(`Razorpay refused the refund: ${message}`);
  }

  if (request.coins > 0) {
    await creditCoins(String(request.user), request.coins, "refund", {
      note: "Refund for a cancelled booking",
      relatedBooking: String(request.booking),
    });
  }

  request.status = "approved";
  request.set("decidedBy", new Types.ObjectId(adminId));
  request.decidedAt = new Date();
  await request.save();

  void notifyUser(String(request.user), {
    type: "booking",
    title: "✅ Refund sent",
    body:
      `We've refunded ${describe(request.amount, request.coins)}.` +
      (request.amount > 0 ? " Bank refunds usually reach your account in 5–7 working days." : ""),
    data: { bookingId: String(request.booking), url: `/app/track/${request.booking}` },
  }).catch((err) => console.error("refund notify failed:", (err as Error).message));

  return request;
}

export async function rejectRefund(id: string, adminId: string, note: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Refund not found");
  const request = await RefundRequest.findOneAndUpdate(
    { _id: id, status: "pending" },
    {
      $set: {
        status: "rejected",
        note: note.trim(),
        decidedBy: new Types.ObjectId(adminId),
        decidedAt: new Date(),
      },
    },
    { new: true },
  );
  if (!request) {
    const existing = await RefundRequest.findById(id).select("status");
    if (!existing) throw ApiError.notFound("Refund not found");
    throw ApiError.badRequest(`This refund is already ${existing.status}`);
  }

  void notifyUser(String(request.user), {
    type: "booking",
    title: "Refund update",
    body:
      `Your refund for the cancelled booking wasn't approved.` +
      (request.note ? ` Reason: ${request.note}` : " Contact support if you have questions."),
    data: { bookingId: String(request.booking), url: `/app/track/${request.booking}` },
  }).catch((err) => console.error("refund notify failed:", (err as Error).message));

  return request;
}

function describeGatewayError(err: unknown): string {
  const e = err as { error?: { description?: string }; message?: string };
  return e?.error?.description || e?.message || "unknown error";
}
