import { Booking } from "./booking.model";
import { User } from "../user/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { agentLiveSince } from "../user/presence";
import { getPrice, getPackageRecord } from "../pricing/pricing.service";
import { applyDiscountCode, incrementDiscountUsage } from "../promotions/discountCode.service";
import { notifyUser } from "../notification/notification.service";
import type { CreateBookingInput } from "./booking.validation";

export async function listBookings(userId: string) {
  return Booking.find({ user: userId }).sort({ createdAt: -1 });
}

/**
 * Server-side authoritative price for a booking, with an optional discount code applied.
 * Shared by booking creation and payment order creation so the amount charged always matches.
 */
export async function computePrice(input: {
  vehicleType: CreateBookingInput["vehicleType"];
  packageId: string;
  discountCode?: string;
}) {
  const pkg = await getPackageRecord(input.packageId);
  if (!pkg || pkg.active === false) throw ApiError.badRequest("Unknown package");

  const basePrice = await getPrice(input.vehicleType, pkg.id);
  if (!input.discountCode) {
    return { pkg, basePrice, price: basePrice, discountAmount: 0, discountCodeId: null, discountCodeLabel: null };
  }

  const { discountAmount, codeId, code } = await applyDiscountCode(input.discountCode, basePrice);
  return { pkg, basePrice, price: basePrice - discountAmount, discountAmount, discountCodeId: codeId, discountCodeLabel: code };
}

export async function createBooking(userId: string, input: CreateBookingInput) {
  const { pkg, price, discountAmount, discountCodeId, discountCodeLabel } = await computePrice(input);

  // Derive the society from the customer's matching address (for area routing).
  const customer = await User.findById(userId);
  const society =
    customer?.addresses.find((a) => a.line === input.addressLine)?.society ?? input.addressLine;

  // Auto-assign an available agent in that area (fallback: any verified, live agent).
  const liveFilter = { role: "agent", agentStatus: "verified", online: true, lastSeenAt: { $gte: agentLiveSince() } };
  const agent =
    (await User.findOne({ ...liveFilter, area: society })) ?? (await User.findOne(liveFilter));

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
    price,
    discountCode: discountCodeLabel,
    discountAmount,
    status: "upcoming",
    assignedAgent: agent?.id ?? null,
    agentName: agent?.name ?? null,
    jobStatus: "assigned",
  });

  // Only mark the code as used once a booking is actually created from it.
  if (discountCodeId) void incrementDiscountUsage(discountCodeId);

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
  booking.status = "cancelled";
  await booking.save();
  return booking;
}
