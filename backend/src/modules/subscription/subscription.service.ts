import { User } from "../user/user.model";
import { logBookingEvent } from "../booking/bookingEvent.service";
import { Booking } from "../booking/booking.model";
import { Plan } from "../catalog/plan.model";
import { ApiError } from "../../shared/utils/ApiError";
import { isValidActivePlan } from "../catalog/plan.service";
import { maybeCreditReferrer } from "../promotions/referral.service";
import { getReferralConfig } from "../promotions/referralConfig.service";
import { computeCoinRedemption, redeemCoins } from "../wallet/wallet.service";
import { Payment } from "../payment/payment.model";
import { paymentsLive, createRazorpayOrder, verifyRazorpaySignature, razorpayKeyId, mockOrderId } from "../payment/razorpay";

const PLAN_PACKAGE_MAP: Record<string, { id: string; name: string }> = {
  basic: { id: "express", name: "Express Wash" },
  premium: { id: "premium", name: "Premium Detail" },
  elite: { id: "ultimate", name: "Ultimate Detail" },
};

/**
 * A subscription is one prepaid 30-day cycle — nothing renews it. Scheduling
 * used to accept any date, including after the cycle had ended; those washes
 * were created (and dispatched) but fell outside the schedule board's date
 * window, so to the customer the wash simply never appeared, and it never
 * counted towards the plan's limit either.
 */
function assertWithinCycle(
  user: { subscriptionEndDate?: Date | null },
  date: Date,
): void {
  const end = user.subscriptionEndDate;
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest("Pick a valid date");
  const endLabel = end?.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  if (!end || end.getTime() <= Date.now()) {
    throw ApiError.badRequest(
      `Your subscription ended${endLabel ? ` on ${endLabel}` : ""}. Renew your plan to schedule more washes.`,
    );
  }
  if (date.getTime() > end.getTime()) {
    throw ApiError.badRequest(`Pick a date on or before ${endLabel}, when this billing cycle ends.`);
  }
}

export async function isPlanId(value: string): Promise<boolean> {
  return isValidActivePlan(value);
}

/** Monthly price of a plan for a given vehicle category, falling back to its cheapest tier. */
function planPriceFor(plan: { prices: unknown }, vehicleType?: string): number {
  const prices = (plan.prices ?? {}) as Record<string, number>;
  if (vehicleType && typeof prices[vehicleType] === "number") return prices[vehicleType];
  const values = Object.values(prices).filter((n): n is number => typeof n === "number");
  return values.length ? Math.min(...values) : 0;
}

/** Preview the subscription price with any coins applied, without committing. */
export async function previewSubscription(
  userId: string,
  planId: string,
  vehicleType?: string,
  coinsToRedeem?: number,
) {
  const plan = await Plan.findById(planId);
  if (!plan || !plan.active) throw ApiError.badRequest("Unknown plan");
  const basePrice = planPriceFor(plan, vehicleType);
  const { coinsRedeemed, coinDiscount } = await computeCoinRedemption(userId, basePrice, coinsToRedeem);
  const { coinsPerRupee } = await getReferralConfig();
  return { basePrice, price: basePrice - coinDiscount, coinsRedeemed, coinDiscount, coinsPerRupee };
}

export async function subscribe(
  userId: string,
  planId: string,
  opts: { vehicleType?: string; coinsToRedeem?: number } = {},
) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found");

  const plan = await Plan.findById(planId);
  if (!plan || !plan.active) throw ApiError.badRequest("Unknown plan");

  // Spend any redeemed coins against the plan price (debited up front, like bookings).
  const basePrice = planPriceFor(plan, opts.vehicleType);
  const { coinsRedeemed } = await computeCoinRedemption(userId, basePrice, opts.coinsToRedeem);
  if (coinsRedeemed > 0) {
    await redeemCoins(userId, coinsRedeemed, { note: `Redeemed on ${plan.name} subscription` });
  }

  user.activePlan = planId;
  user.subscriptionStartDate = new Date();
  user.subscriptionEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await user.save();

  // Buying a subscription is a qualifying referral milestone.
  void maybeCreditReferrer(userId, "subscription").catch((err) =>
    console.error("referral credit failed:", (err as Error).message),
  );

  return user;
}

/** Create a Razorpay order (or a mock/free placeholder) for a subscription purchase. */
export async function createSubscriptionOrder(
  userId: string,
  input: { planId: string; vehicleType?: string; coinsToRedeem?: number },
) {
  const { price } = await previewSubscription(userId, input.planId, input.vehicleType, input.coinsToRedeem);
  const plan = await Plan.findById(input.planId).select("name");
  // Tagged so plan revenue can be reported, and kept out of cleaner settlement.
  const purchase = { kind: "subscription" as const, planId: input.planId, planName: plan?.name ?? input.planId };

  // No live keys, or coins cover the whole amount → nothing to charge via Razorpay.
  if (!paymentsLive || price <= 0) {
    const orderId = mockOrderId("sub_mock");
    await Payment.create({ user: userId, orderId, amount: price, status: "mock", ...purchase });
    return { orderId, amount: price, currency: "INR", keyId: "", mock: true };
  }

  const order = await createRazorpayOrder(price, `sub_${Date.now()}`);
  await Payment.create({ user: userId, orderId: order.id, amount: price, status: "created", ...purchase });
  return { orderId: order.id, amount: price, currency: "INR", keyId: razorpayKeyId, mock: false };
}

/** Verify the Razorpay signature (live) then activate the subscription. */
export async function verifyAndSubscribe(
  userId: string,
  input: {
    planId: string;
    vehicleType?: string;
    coinsToRedeem?: number;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  },
) {
  const { price } = await previewSubscription(userId, input.planId, input.vehicleType, input.coinsToRedeem);

  if (paymentsLive && price > 0) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = input;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw ApiError.badRequest("Missing payment confirmation fields");
    }
    if (!verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      throw ApiError.badRequest("Payment signature verification failed");
    }
    await Payment.findOneAndUpdate(
      { orderId: razorpay_order_id },
      { paymentId: razorpay_payment_id, status: "paid" },
    );
  } else if (input.razorpay_order_id) {
    // Mock/free path: mark the placeholder order paid for record-keeping.
    await Payment.findOneAndUpdate({ orderId: input.razorpay_order_id }, { status: "paid" });
  }

  return subscribe(userId, input.planId, {
    vehicleType: input.vehicleType,
    coinsToRedeem: input.coinsToRedeem,
  });
}

export async function unsubscribe(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  user.activePlan = null;
  await user.save();
  return user;
}

export async function getSubscriptionSchedule(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  if (!user.activePlan) {
    return { activePlan: null, subscriptionStartDate: null, subscriptionEndDate: null, bookings: [] };
  }

  const plan = await Plan.findById(user.activePlan);
  const bookings = await Booking.find({
    user: userId,
    isSubscriptionWash: true,
    status: { $ne: "cancelled" },
    date: {
      $gte: user.subscriptionStartDate,
      $lte: user.subscriptionEndDate,
    },
  }).sort({ date: 1 });

  return {
    activePlan: plan,
    subscriptionStartDate: user.subscriptionStartDate,
    subscriptionEndDate: user.subscriptionEndDate,
    expired: !user.subscriptionEndDate || user.subscriptionEndDate.getTime() <= Date.now(),
    bookings,
  };
}

export async function scheduleSubscriptionWash(
  userId: string,
  input: { vehicleId: string; addressId: string; date: string; slot: string },
) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  if (!user.activePlan) throw ApiError.badRequest("You do not have an active subscription plan");

  const plan = await Plan.findById(user.activePlan);
  if (!plan) throw ApiError.badRequest("Active subscription plan details not found");

  assertWithinCycle(user, new Date(input.date));

  const vehicle = user.vehicles.find((v) => String(v._id) === input.vehicleId);
  if (!vehicle) throw ApiError.notFound("Vehicle not found");

  const address = user.addresses.find((a) => String(a._id) === input.addressId);
  if (!address) throw ApiError.notFound("Address not found");

  // Validate package matching user's subscription tier. Plans an admin adds
  // later have no entry here; they get the entry-level wash rather than a
  // customer-facing "package mapping not found" that blocks scheduling.
  const pkg = PLAN_PACKAGE_MAP[plan.id] ?? PLAN_PACKAGE_MAP.basic;

  // Check wash limit for the current cycle
  const used = await Booking.countDocuments({
    user: userId,
    isSubscriptionWash: true,
    status: { $ne: "cancelled" },
    date: {
      $gte: user.subscriptionStartDate,
      $lte: user.subscriptionEndDate,
    },
  });

  if (plan.washesPerMonth !== -1 && used >= plan.washesPerMonth) {
    throw ApiError.badRequest(`Wash limit reached for the current cycle (${plan.washesPerMonth} washes max)`);
  }

  // Derive the society + service coordinates from the chosen address.
  const society = address.society || address.line;
  const addrCoords = address.coordinates;
  const location =
    addrCoords && addrCoords.length === 2
      ? { type: "Point" as const, coordinates: [addrCoords[0], addrCoords[1]] as [number, number] }
      : undefined;

  // No instant assignment — the scheduler auto-assigns the nearest cleaner
  // shortly before the chosen slot (dispatchStatus "scheduled").
  const booking = await Booking.create({
    user: userId,
    vehicleType: vehicle.type,
    vehicleName: vehicle.name,
    vehiclePlate: vehicle.plate && vehicle.plate !== "—" ? vehicle.plate : "",
    vehicleColor: vehicle.color ?? "",
    vehicleColorHex: vehicle.colorHex ?? "",
    packageId: pkg.id,
    packageName: pkg.name,
    date: new Date(input.date),
    slot: input.slot,
    addressLabel: address.label,
    addressLine: address.line,
    society,
    location,
    price: 0,
    isSubscriptionWash: true,
    status: "upcoming",
    assignedAgent: null,
    agentName: null,
    jobStatus: "assigned",
    dispatchStatus: "scheduled",
  });
  logBookingEvent(booking._id, {
    type: "created",
    actor: "customer",
    reason: "Subscription wash scheduled",
    meta: { slot: input.slot, date: new Date(input.date).toISOString(), subscription: true },
  });

  return booking;
}

export async function rescheduleSubscriptionWash(
  userId: string,
  bookingId: string,
  input: { date: string; slot: string },
) {
  const booking = await Booking.findOne({ _id: bookingId, user: userId });
  if (!booking) throw ApiError.notFound("Booking not found");
  if (!booking.isSubscriptionWash) throw ApiError.badRequest("This booking is not part of a subscription");
  if (booking.status !== "upcoming") throw ApiError.badRequest("Only upcoming washes can be rescheduled");

  // Validate 12-hour constraint
  const diffMs = new Date(booking.date).getTime() - Date.now();
  if (diffMs < 12 * 60 * 60 * 1000) {
    throw ApiError.badRequest("Subscription washes can only be rescheduled at least 12 hours in advance");
  }

  const user = await User.findById(userId).select("subscriptionEndDate");
  assertWithinCycle(user ?? {}, new Date(input.date));

  const previous = { date: booking.date, slot: booking.slot };
  booking.date = new Date(input.date);
  booking.slot = input.slot;
  // New slot, new reminder windows — the ones already sent were for the old time.
  booking.remindersSent = [];
  await booking.save();
  logBookingEvent(booking._id, {
    type: "rescheduled",
    actor: "customer",
    meta: {
      fromDate: previous.date ? new Date(previous.date).toISOString() : null,
      fromSlot: previous.slot,
      toDate: booking.date.toISOString(),
      toSlot: booking.slot,
    },
  });
  return booking;
}
