import { Booking, type BookingDocument } from "./booking.model";
import { computeTax } from "../bookkeeping/tax";
import { getTaxSettings } from "../bookkeeping/bookkeepingConfig.service";
import { bookingAmountDue } from "../bookkeeping/invoice.service";
import { Types } from "mongoose";
import { User } from "../user/user.model";
import { getReviewForBooking, reviewsByBooking } from "../review/review.service";
import { ApiError } from "../../shared/utils/ApiError";
import { getPrice, getPackageRecord } from "../pricing/pricing.service";
import { applyDiscountCode, incrementDiscountUsage } from "../promotions/discountCode.service";
import { applySpecialCoupon, markSpecialCouponUsed } from "../promotions/specialCoupon.service";
import { SPECIAL_COUPON_PREFIX } from "../promotions/specialCoupon.model";
import { redeemCoins, computeCoinRedemption } from "../wallet/wallet.service";
import { notifyUser } from "../notification/notification.service";
import { startDispatch, offerNext, emitDispatchUpdate, emitCancelToAgent } from "../dispatch/dispatch.service";
import { getSlotTimeRange } from "../dispatch/slotScheduler.service";
import {
  syncCashLedgerAmount,
  createRescheduleOrder,
  claimReschedulePayment,
  onlinePaymentAvailable,
} from "../payment/ledger.service";
import { evaluateReschedule, assertCustomerMayReschedule, assertSlotHasNotice } from "./reschedule.service";
import { toPoint } from "../../shared/geo";
import { broadcastJobStatus, forgetAgentBookings } from "../tracking/tracking.service";
import type { CreateBookingInput } from "./booking.validation";
import { queueCancellationRefund } from "../refund/refund.service";
import { tellAgentJobCancelled } from "./jobCancelled";
import { logBookingEvent } from "./bookingEvent.service";

/** The wall-clock instant a slot begins on a given date — used for lead-time checks. */
function slotStart(date: Date, slot: string): Date {
  if (Number.isNaN(date.getTime())) return date;
  return getSlotTimeRange(date, slot).start;
}

/** How many finished/cancelled bookings the unpaged list carries alongside every upcoming one. */
const RECENT_HISTORY = 20;
/** Upper bound on upcoming bookings in the unpaged list — far more than anyone has in flight. */
const MAX_UPCOMING = 100;

async function withReviews(bookings: BookingDocument[]) {
  const reviews = await reviewsByBooking(bookings.filter((b) => b.status === "completed").map((b) => b._id));
  return bookings.map((b) => ({ ...b.toJSON(), review: reviews.get(String(b._id)) ?? null }));
}

/**
 * The customer's working set: every upcoming booking (live tracking, the
 * completion listener and the dashboard all need those) plus the most recent
 * finished ones, newest first. Bounded — the full history is paged through
 * listBookingsPage instead, so a long-time customer's app doesn't download
 * years of bookings on every open.
 */
export async function listBookings(userId: string) {
  const [upcoming, recent] = await Promise.all([
    Booking.find({ user: userId, status: "upcoming" }).sort({ createdAt: -1 }).limit(MAX_UPCOMING),
    Booking.find({ user: userId, status: { $ne: "upcoming" } }).sort({ createdAt: -1 }).limit(RECENT_HISTORY),
  ]);
  const merged = [...upcoming, ...recent].sort((a, b) => {
    const diff = new Date(b.get("createdAt")).getTime() - new Date(a.get("createdAt")).getTime();
    return diff !== 0 ? diff : String(b._id).localeCompare(String(a._id));
  });
  return withReviews(merged);
}

export type BookingStatusFilter = "all" | "upcoming" | "completed" | "cancelled";

/**
 * One page of the customer's bookings for the My bookings screen, filtered
 * by status on the server, newest first, plus the per-status counts the
 * filter tabs show.
 */
export async function listBookingsPage(
  userId: string,
  opts: { status: BookingStatusFilter; page: number; limit: number },
) {
  const filter: Record<string, unknown> = { user: userId };
  if (opts.status !== "all") filter.status = opts.status;
  const skip = (opts.page - 1) * opts.limit;
  const [items, total, grouped] = await Promise.all([
    Booking.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(opts.limit),
    Booking.countDocuments(filter),
    Booking.aggregate<{ _id: string; n: number }>([
      { $match: { user: new Types.ObjectId(userId) } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
  ]);
  const counts = { all: 0, upcoming: 0, completed: 0, cancelled: 0 };
  grouped.forEach((g) => {
    if (g._id in counts) counts[g._id as keyof typeof counts] = g.n;
    counts.all += g.n;
  });
  return {
    items: await withReviews(items),
    page: opts.page,
    limit: opts.limit,
    total,
    hasMore: skip + items.length < total,
    counts,
  };
}

/** One of the customer's own bookings, with the cleaner and any review — the booking detail page. */
export async function getOwnBooking(userId: string, bookingId: string) {
  if (!Types.ObjectId.isValid(bookingId)) throw ApiError.notFound("Booking not found");
  const booking = await Booking.findOne({ _id: bookingId, user: userId });
  if (!booking) throw ApiError.notFound("Booking not found");
  const [review, agent] = await Promise.all([
    getReviewForBooking(bookingId),
    booking.assignedAgent
      ? User.findById(booking.assignedAgent).select("name rating ratingCount jobsDone").lean()
      : Promise.resolve(null),
  ]);
  return {
    ...booking.toJSON(),
    review,
    agent: agent
      ? {
          id: String(agent._id),
          name: agent.name ?? booking.agentName ?? "Cleaner",
          rating: agent.rating ?? 0,
          ratingCount: agent.ratingCount ?? 0,
          jobsDone: agent.jobsDone ?? 0,
        }
      : null,
  };
}

/**
 * Server-side authoritative price for a booking, with an optional discount code applied.
 * Shared by booking creation and payment order creation so the amount charged always matches.
 */
export async function computePrice(
  userId: string,
  input: {
    vehicleType: CreateBookingInput["vehicleType"];
    packageId: string;
    discountCode?: string;
    coinsToRedeem?: number;
    // The slot the code is being spent on. Off-peak-only codes are validated
    // against it; supplied by both booking creation and the checkout quote so
    // the two can never disagree about whether a code applies.
    date?: string;
    slot?: string;
  },
) {
  const pkg = await getPackageRecord(input.packageId);
  if (!pkg || pkg.active === false) throw ApiError.badRequest("Unknown package");

  const basePrice = await getPrice(input.vehicleType, pkg.id);

  // 1) Discount code, if supplied.
  let discountAmount = 0;
  let discountCodeId: string | null = null;
  let discountCodeLabel: string | null = null;
  let isSpecialCoupon = false;
  // Whether the code that produced `discountAmount` was gated on an off-peak
  // slot. Drives the booking's reclaim snapshot — see booking.model.
  let discountWasOffPeakGated = false;
  if (input.discountCode) {
    const raw = input.discountCode.trim().toUpperCase();
    isSpecialCoupon = raw.startsWith(SPECIAL_COUPON_PREFIX);
    // Only a well-formed date *and* slot make a usable context; a half-supplied
    // pair would be worse than none, since assertOffPeakEligible's "pick your slot
    // first" message is clearer than a check against a NaN date.
    const parsedDate = input.date ? new Date(input.date) : null;
    const redemptionContext =
      parsedDate && !Number.isNaN(parsedDate.getTime()) && input.slot
        ? { date: parsedDate, slot: input.slot }
        : undefined;
    const applied = isSpecialCoupon
      ? await (async () => {
          const r = await applySpecialCoupon(raw, basePrice, userId, redemptionContext);
          return {
            discountAmount: r.discountAmount,
            codeId: r.couponId,
            code: r.code,
            offPeakOnly: r.offPeakOnly,
          };
        })()
      : await applyDiscountCode(raw, basePrice, redemptionContext);
    discountAmount = applied.discountAmount;
    discountCodeId = applied.codeId;
    discountCodeLabel = applied.code;
    discountWasOffPeakGated = applied.offPeakOnly;
  }

  const priceAfterDiscount = basePrice - discountAmount;

  // 2) Coin redemption, capped by the admin's max-redeem % and the user's balance.
  const { coinsRedeemed, coinDiscount } = await computeCoinRedemption(
    userId,
    priceAfterDiscount,
    input.coinsToRedeem,
  );

  // A zero-value off-peak discount leaves nothing to reclaim, so it must not
  // lock the booking — that would refuse a peak move (or demand a fee) over a
  // subsidy the customer never actually received.
  const offPeakDiscountAmount = discountWasOffPeakGated ? discountAmount : 0;

  const price = priceAfterDiscount - coinDiscount;
  const taxSettings = await getTaxSettings();
  const tax = { ...computeTax(price, taxSettings), supplyType: taxSettings.supplyType, label: taxSettings.label };

  return {
    pkg,
    basePrice,
    price,
    // GST on top of `price` (bookkeeping/tax.ts). `tax.payableAmount` is what gets charged.
    tax,
    discountAmount,
    discountCodeId,
    discountCodeLabel,
    isSpecialCoupon,
    coinsRedeemed,
    coinDiscount,
    offPeakLocked: offPeakDiscountAmount > 0,
    offPeakDiscountAmount,
  };
}

export type ComputedBookingPrice = Awaited<ReturnType<typeof computePrice>>;

export async function createBooking(
  userId: string,
  input: CreateBookingInput,
  // Only internal payment code supplies this. It is the server-computed
  // snapshot stored with a gateway order, never a value accepted from a
  // browser request.
  pricedAtOrder?: ComputedBookingPrice,
) {
  // A paid order was checked for notice when it was created (createOrder); the
  // customer has paid since, so it isn't turned away for the minutes that took.
  if (!pricedAtOrder) await assertSlotHasNotice(new Date(input.date), input.slot);

  const {
    pkg, price, discountAmount, discountCodeId, discountCodeLabel, isSpecialCoupon,
    coinsRedeemed, coinDiscount, offPeakLocked, offPeakDiscountAmount, tax: pricedTax,
  } = pricedAtOrder ?? await computePrice(userId, input);
  // An order opened before GST existed carries no tax in its snapshot: it was charged without any.
  const tax = pricedTax ?? { ...computeTax(price, null), supplyType: "intra" as const };

  // Debit the redeemed coins up front so a discounted booking can never be
  // created without the coins actually being spent (throws if balance is short).
  if (coinsRedeemed > 0) {
    await redeemCoins(userId, coinsRedeemed, { note: `Redeemed on booking (${pkg.name})` });
  }

  // Derive the society + service coordinates from the customer's matching address.
  const customer = await User.findById(userId);
  const matchedAddress = customer?.addresses.find((a) => a.line === input.addressLine);
  const society = matchedAddress?.society ?? input.addressLine;

  // Prefer coordinates the client sent; fall back to the saved address's geo.
  const addrCoords = matchedAddress?.coordinates;
  const location =
    toPoint(input.lat, input.lng) ??
    (addrCoords && addrCoords.length === 2
      ? { type: "Point" as const, coordinates: [addrCoords[0], addrCoords[1]] as [number, number] }
      : undefined);

  // No instant assignment — the booking enters the real-time dispatch pipeline.
  const booking = await Booking.create({
    user: userId,
    vehicleType: input.vehicleType,
    vehicleName: input.vehicleName,
    vehiclePlate: input.vehiclePlate && input.vehiclePlate !== "—" ? input.vehiclePlate : "",
    vehicleColor: input.vehicleColor ?? "",
    vehicleColorHex: input.vehicleColorHex ?? "",
    packageId: pkg.id,
    packageName: pkg.name,
    date: new Date(input.date),
    slot: input.slot,
    addressLabel: input.addressLabel,
    addressLine: input.addressLine,
    society,
    location,
    price,
    taxableAmount: tax.taxableAmount,
    taxRate: tax.taxRate,
    taxSupplyType: tax.supplyType,
    cgstAmount: tax.cgstAmount,
    sgstAmount: tax.sgstAmount,
    igstAmount: tax.igstAmount,
    taxAmount: tax.taxAmount,
    taxRoundOff: tax.roundOff,
    payableAmount: tax.payableAmount,
    discountCode: discountCodeLabel,
    discountAmount,
    coinsRedeemed,
    coinDiscount,
    offPeakLocked,
    offPeakDiscountAmount,
    status: "upcoming",
    assignedAgent: null,
    agentName: null,
    jobStatus: "assigned",
    dispatchStatus: "searching",
  });
  logBookingEvent(booking._id, {
    type: "created",
    actor: "customer",
    actorName: customer?.name ?? "",
    meta: { slot: input.slot, date: new Date(input.date).toISOString(), price, payable: tax.payableAmount },
  });

  // Fire-and-forget: broadcast the job to nearby cleaners (nearest-first offers).
  void startDispatch(booking.id).catch((err) =>
    console.error("dispatch start failed:", (err as Error).message),
  );

  // Only mark the code as used once a booking is actually created from it.
  if (discountCodeId) {
    if (isSpecialCoupon) {
      void markSpecialCouponUsed(discountCodeId, { bookingId: booking.id, userId, discountAmount })
        .catch((err) => console.error("special coupon mark-used failed:", (err as Error).message));
    } else {
      void incrementDiscountUsage(discountCodeId);
    }
  }

  // Fire-and-forget confirmation push; never block booking creation on it.
  const when = new Date(input.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  void notifyUser(userId, {
    type: "booking",
    title: "✅ Booking confirmed",
    body: `Your ${pkg.name} for ${input.vehicleName} is booked for ${when} at ${input.slot}.`,
    data: { bookingId: booking.id },
  }).catch((err) => console.error("booking notification failed:", (err as Error).message));

  return booking;
}

/** Owned, still-movable booking, or a 404/400 the customer can act on. */
async function getOwnedUpcomingBooking(userId: string, bookingId: string) {
  const booking = await Booking.findOne({ _id: bookingId, user: userId });
  if (!booking) throw ApiError.notFound("Booking not found");
  return booking;
}

/**
 * What moving this booking would cost, without moving it. Drives the customer's
 * reschedule screen, which has to show the number before asking for consent.
 */
export async function previewReschedule(
  userId: string,
  bookingId: string,
  input: { date: string; slot: string },
) {
  const booking = await getOwnedUpcomingBooking(userId, bookingId);
  const newDate = new Date(input.date);
  assertCustomerMayReschedule(booking, slotStart(newDate, input.slot));
  await assertSlotHasNotice(newDate, input.slot);
  const quote = await evaluateReschedule(booking, newDate, input.slot);
  // The screen needs to know whether to offer "pay now" at all — without a live
  // gateway the only honest option is paying the cleaner.
  return { ...quote, onlinePaymentAvailable: onlinePaymentAvailable() };
}

/**
 * Open a gateway order for an upcharge the customer has chosen to pay now.
 * Nothing about the booking changes here; the move happens on commit, once the
 * signature has been verified.
 */
export async function createRescheduleUpgradeOrder(
  userId: string,
  bookingId: string,
  input: { date: string; slot: string },
) {
  const booking = await getOwnedUpcomingBooking(userId, bookingId);
  const newDate = new Date(input.date);
  assertCustomerMayReschedule(booking, slotStart(newDate, input.slot));
  await assertSlotHasNotice(newDate, input.slot);

  const quote = await evaluateReschedule(booking, newDate, input.slot);
  if (!quote.requiresPayment) {
    throw ApiError.badRequest("This change is free — no payment is needed");
  }

  return createRescheduleOrder(userId, bookingId, {
    date: newDate,
    slot: input.slot,
    reclaim: quote.reclaim,
    fee: quote.fee,
    totalDue: quote.totalDue,
  });
}

/**
 * Move a booking to a new slot.
 *
 * The guard is re-run here rather than trusted from the preview: a quote is
 * advisory, and between seeing a price and accepting it the cleaner may have set
 * off, the config may have changed, or the customer may have used up their
 * moves. Re-quoting also means a stale quote cannot be replayed at yesterday's
 * price.
 *
 * When money is owed, `paymentMethod` decides how it is collected. "cash" adds
 * it to what the cleaner collects on completion; the online route arrives with
 * a verified payment reference. Without either, the move is refused rather than
 * granted on credit — that would be the original loophole in a new costume.
 */
export async function rescheduleOwnBooking(
  userId: string,
  bookingId: string,
  input: {
    date: string;
    slot: string;
    paymentMethod?: "cash" | "online";
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  },
) {
  const booking = await getOwnedUpcomingBooking(userId, bookingId);
  const newDate = new Date(input.date);
  assertCustomerMayReschedule(booking, slotStart(newDate, input.slot));
  await assertSlotHasNotice(newDate, input.slot);

  const quote = await evaluateReschedule(booking, newDate, input.slot);

  if (quote.requiresPayment) {
    if (input.paymentMethod === "online") {
      // Claim the payment BEFORE touching the slot. Reversed, an abandoned
      // checkout would leave the customer holding a peak slot they never paid
      // for — the original loophole wearing a different hat.
      const intent = await claimReschedulePayment(userId, bookingId, input);

      // The receipt has to be for *this* move. A payment taken for a cheap
      // upgrade must not be redeemable against a dearer slot.
      const sameSlot = intent.slot === input.slot;
      const sameDay = new Date(intent.date).toDateString() === newDate.toDateString();
      if (!sameSlot || !sameDay) {
        throw ApiError.badRequest("This payment was for a different date or time — start the change again");
      }
      if (intent.totalDue < quote.totalDue) {
        throw ApiError.badRequest("The price of this change has gone up — start the change again");
      }
    } else if (input.paymentMethod !== "cash") {
      throw ApiError.badRequest(
        `${quote.reason} Choose how you'd like to pay the ₹${quote.totalDue} to continue.`,
      );
    }
  }

  const paidOnline = quote.requiresPayment && input.paymentMethod === "online";

  if (quote.requiresPayment) {
    // `price` takes only the reclaimed subsidy — it is the service value the
    // cleaner is paid a percentage of. The fee is tracked beside it and never
    // reaches the cleaner's cut.
    booking.price = quote.newPrice;
    booking.peakUpgradeFeeCharged = (booking.peakUpgradeFeeCharged ?? 0) + quote.fee;
    // The subsidy has been repaid, so the booking is no longer tied to off-peak.
    // Leaving the lock on would charge the customer a second time for a further
    // move they have already paid to make.
    booking.offPeakLocked = false;
    booking.offPeakDiscountAmount = 0;
  }

  const previous = { date: booking.date, slot: booking.slot };
  booking.date = newDate;
  booking.slot = input.slot;
  booking.lastRescheduledAt = new Date();
  // New slot, new reminder windows — the ones already sent were for the old time.
  booking.remindersSent = [];

  // Re-enter dispatch exactly as the admin path does: the old offer is void and
  // the agent lock has to be released, or the cleaner keeps a job at a time the
  // customer has moved away from.
  const prevOfferAgent = booking.currentOfferAgent ? String(booking.currentOfferAgent) : null;
  booking.dispatchStatus = "searching";
  booking.currentOfferAgent = null;
  booking.offerExpiresAt = null;
  booking.set("declinedAgents", []);
  await booking.save();
  logBookingEvent(booking._id, {
    type: "rescheduled",
    actor: "customer",
    meta: {
      fromDate: previous.date ? new Date(previous.date).toISOString() : null,
      fromSlot: previous.slot,
      toDate: newDate.toISOString(),
      toSlot: input.slot,
      feePaid: quote.requiresPayment ? quote.totalDue : 0,
    },
  });

  // Counted with $inc rather than a read-modify-write on the document.
  // Simultaneous moves each start from the same snapshot, so `count + 1` makes
  // them all write the same number and the total under-reports — which would
  // hand a customer more moves than the cap allows. The money fields are safe
  // either way because they are absolute rather than accumulated, but this one
  // genuinely accumulates.
  const counted = await Booking.findByIdAndUpdate(
    bookingId,
    { $inc: { customerRescheduleCount: 1 } },
    { new: true },
  );

  if (prevOfferAgent) {
    await User.updateOne({ _id: prevOfferAgent, currentOfferBooking: bookingId }, { currentOfferBooking: null });
    emitCancelToAgent(prevOfferAgent, bookingId);
  }

  // Only the cash route changes what the cleaner collects. An online upgrade is
  // already settled in its own paid ledger row, so raising the cash row too
  // would bill the customer for the upgrade twice — once at the gateway and
  // again at the door.
  if (quote.requiresPayment && !paidOnline) {
    void syncCashLedgerAmount(booking.id, bookingAmountDue(booking)).catch((err) =>
      console.error("ledger sync after reschedule failed:", (err as Error).message),
    );
  }

  emitDispatchUpdate();
  void offerNext(bookingId).catch((err) =>
    console.error("offerNext after customer reschedule failed:", (err as Error).message),
  );

  return { booking: counted ?? booking, quote };
}

export async function cancelBooking(userId: string, bookingId: string) {
  const booking = await Booking.findOne({ _id: bookingId, user: userId });
  if (!booking) throw ApiError.notFound("Booking not found");
  if (booking.status !== "upcoming") {
    throw ApiError.badRequest("Only upcoming bookings can be cancelled");
  }
  // Once the cleaner is working on the car the service is being delivered;
  // stopping it is a support conversation, not a button.
  if (booking.jobStatus === "in_progress") {
    throw ApiError.badRequest(
      "Cleaning has already started, so this booking can't be cancelled. Contact support if something's wrong.",
    );
  }
  if (booking.isSubscriptionWash) {
    const diffMs = new Date(booking.date).getTime() - Date.now();
    if (diffMs < 12 * 60 * 60 * 1000) {
      throw ApiError.badRequest("Subscription washes can only be cancelled at least 12 hours in advance");
    }
  }
  // Close dispatch out exactly as the admin path does. Leaving it "offered"
  // kept the cleaner holding the offer locked to a dead booking (no new offers
  // could reach them) with a popup that still let them accept it.
  const prevOfferAgent = booking.currentOfferAgent ? String(booking.currentOfferAgent) : null;
  booking.status = "cancelled";
  booking.dispatchStatus = "cancelled";
  booking.currentOfferAgent = null;
  booking.offerExpiresAt = null;
  await booking.save();
  logBookingEvent(booking._id, {
    type: "cancelled",
    actor: "customer",
    agentId: booking.assignedAgent,
    agentName: booking.agentName,
  });
  // Whatever was paid for it (online and/or coins) goes to Admin → Refunds for approval.
  void queueCancellationRefund(String(booking._id), "customer").catch((err) =>
    console.error("refund queue failed:", (err as Error).message),
  );
  if (prevOfferAgent) {
    await User.updateOne({ _id: prevOfferAgent, currentOfferBooking: bookingId }, { currentOfferBooking: null });
    emitCancelToAgent(prevOfferAgent, bookingId);
  }
  emitDispatchUpdate();
  forgetAgentBookings(booking.assignedAgent ? String(booking.assignedAgent) : null);
  broadcastJobStatus(booking);

  // A cleaner already assigned to this job may be on their way to it. Telling
  // them only over a socket they might not be connected to is how someone ends
  // up driving to a cancelled booking.
  tellAgentJobCancelled(booking.assignedAgent ? String(booking.assignedAgent) : null, booking, "customer");

  // The customer's own receipt of the cancellation, and so a second signed-in
  // device stays in sync without needing to reopen the tracking screen.
  void notifyUser(userId, {
    type: "booking",
    title: "❌ Booking cancelled",
    body: `Your ${booking.packageName} for ${booking.slot} has been cancelled.`,
    data: { bookingId: String(booking._id), url: `/app/track/${booking._id}` },
  }).catch((err) => console.error("cancel notification failed:", (err as Error).message));

  return booking;
}
