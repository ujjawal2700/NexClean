import { Booking } from "./booking.model";
import { User } from "../user/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { getPrice, getPackageRecord } from "../pricing/pricing.service";
import { notifyUser } from "../notification/notification.service";
import type { CreateBookingInput } from "./booking.validation";

export async function listBookings(userId: string) {
  return Booking.find({ user: userId }).sort({ createdAt: -1 });
}

export async function createBooking(userId: string, input: CreateBookingInput) {
  const pkg = await getPackageRecord(input.packageId);
  if (!pkg || pkg.active === false) throw ApiError.badRequest("Unknown package");

  // Price is computed server-side from the live pricing — never trusted from the client.
  const price = await getPrice(input.vehicleType, pkg.id);

  // Derive the society from the customer's matching address (for area routing).
  const customer = await User.findById(userId);
  const society =
    customer?.addresses.find((a) => a.line === input.addressLine)?.society ?? input.addressLine;

  // Auto-assign an available agent in that area (fallback: any verified, online agent).
  const agent =
    (await User.findOne({ role: "agent", agentStatus: "verified", online: true, area: society })) ??
    (await User.findOne({ role: "agent", agentStatus: "verified", online: true }));

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
    status: "upcoming",
    assignedAgent: agent?.id ?? null,
    agentName: agent?.name ?? null,
    jobStatus: "assigned",
  });

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
