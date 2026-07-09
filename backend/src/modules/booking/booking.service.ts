import { Booking } from "./booking.model";
import { User } from "../user/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { getPrice, getPackageRecord } from "../pricing/pricing.service";
import { applyDiscountCode, incrementDiscountUsage } from "../promotions/discountCode.service";
import { applySpecialCoupon, markSpecialCouponUsed } from "../promotions/specialCoupon.service";
import { SPECIAL_COUPON_PREFIX } from "../promotions/specialCoupon.model";
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
  },
) {
  const pkg = await getPackageRecord(input.packageId);
  if (!pkg || pkg.active === false) throw ApiError.badRequest("Unknown package");

  const basePrice = await getPrice(input.vehicleType, pkg.id);
  if (!input.discountCode) {
    return {
      pkg,
      basePrice,
      price: basePrice,
      discountAmount: 0,
      discountCodeId: null,
      discountCodeLabel: null,
      isSpecialCoupon: false,
    };
  }

  const raw = input.discountCode.trim().toUpperCase();
  const isSpecialCoupon = raw.startsWith(SPECIAL_COUPON_PREFIX);
  const { discountAmount, codeId, code } = isSpecialCoupon
    ? await (async () => {
        const r = await applySpecialCoupon(raw, basePrice, userId);
        return { discountAmount: r.discountAmount, codeId: r.couponId, code: r.code };
      })()
    : await applyDiscountCode(raw, basePrice);

  return {
    pkg,
    basePrice,
    price: basePrice - discountAmount,
    discountAmount,
    discountCodeId: codeId,
    discountCodeLabel: code,
    isSpecialCoupon,
  };
}

export async function createBooking(userId: string, input: CreateBookingInput) {
  const { pkg, price, discountAmount, discountCodeId, discountCodeLabel, isSpecialCoupon } =
    await computePrice(userId, input);

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
