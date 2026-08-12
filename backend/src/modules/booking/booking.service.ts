import { Booking } from "./booking.model";
import { User } from "../user/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { getPrice, getPackageRecord } from "../pricing/pricing.service";
import { applyDiscountCode, incrementDiscountUsage } from "../promotions/discountCode.service";
import { applySpecialCoupon, markSpecialCouponUsed } from "../promotions/specialCoupon.service";
import { SPECIAL_COUPON_PREFIX } from "../promotions/specialCoupon.model";
import { redeemCoins, computeCoinRedemption } from "../wallet/wallet.service";
import { notifyUser } from "../notification/notification.service";
import { startDispatch } from "../dispatch/dispatch.service";
import { toPoint } from "../../shared/geo";
import type { CreateBookingInput } from "./booking.validation";

export async function listBookings(userId: string) {
  return Booking.find({ user: userId }).sort({ createdAt: -1 });
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
    // The slot the code is being spent on. Peak-hours-only codes are validated
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
  if (input.discountCode) {
    const raw = input.discountCode.trim().toUpperCase();
    isSpecialCoupon = raw.startsWith(SPECIAL_COUPON_PREFIX);
    // Only a well-formed date *and* slot make a usable context; a half-supplied
    // pair would be worse than none, since assertPeakEligible's "pick your slot
    // first" message is clearer than a check against a NaN date.
    const parsedDate = input.date ? new Date(input.date) : null;
    const redemptionContext =
      parsedDate && !Number.isNaN(parsedDate.getTime()) && input.slot
        ? { date: parsedDate, slot: input.slot }
        : undefined;
    const applied = isSpecialCoupon
      ? await (async () => {
          const r = await applySpecialCoupon(raw, basePrice, userId, redemptionContext);
          return { discountAmount: r.discountAmount, codeId: r.couponId, code: r.code };
        })()
      : await applyDiscountCode(raw, basePrice, redemptionContext);
    discountAmount = applied.discountAmount;
    discountCodeId = applied.codeId;
    discountCodeLabel = applied.code;
  }

  const priceAfterDiscount = basePrice - discountAmount;

  // 2) Coin redemption, capped by the admin's max-redeem % and the user's balance.
  const { coinsRedeemed, coinDiscount } = await computeCoinRedemption(
    userId,
    priceAfterDiscount,
    input.coinsToRedeem,
  );

  return {
    pkg,
    basePrice,
    price: priceAfterDiscount - coinDiscount,
    discountAmount,
    discountCodeId,
    discountCodeLabel,
    isSpecialCoupon,
    coinsRedeemed,
    coinDiscount,
  };
}

export async function createBooking(userId: string, input: CreateBookingInput) {
  const {
    pkg, price, discountAmount, discountCodeId, discountCodeLabel, isSpecialCoupon,
    coinsRedeemed, coinDiscount,
  } = await computePrice(userId, input);

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
    packageId: pkg.id,
    packageName: pkg.name,
    date: new Date(input.date),
    slot: input.slot,
    addressLabel: input.addressLabel,
    addressLine: input.addressLine,
    society,
    location,
    price,
    discountCode: discountCodeLabel,
    discountAmount,
    coinsRedeemed,
    coinDiscount,
    status: "upcoming",
    assignedAgent: null,
    agentName: null,
    jobStatus: "assigned",
    dispatchStatus: "searching",
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

export async function cancelBooking(userId: string, bookingId: string) {
  const booking = await Booking.findOne({ _id: bookingId, user: userId });
  if (!booking) throw ApiError.notFound("Booking not found");
  if (booking.status !== "upcoming") {
    throw ApiError.badRequest("Only upcoming bookings can be cancelled");
  }
  if (booking.isSubscriptionWash) {
    const diffMs = new Date(booking.date).getTime() - Date.now();
    if (diffMs < 12 * 60 * 60 * 1000) {
      throw ApiError.badRequest("Subscription washes can only be cancelled at least 12 hours in advance");
    }
  }
  booking.status = "cancelled";
  await booking.save();
  return booking;
}
