import { Booking } from "./booking.model";
import { ApiError } from "../../shared/utils/ApiError";
import { getPackage, priceFor } from "../catalog/catalog.data";
import type { CreateBookingInput } from "./booking.validation";

export async function listBookings(userId: string) {
  return Booking.find({ user: userId }).sort({ createdAt: -1 });
}

export async function createBooking(userId: string, input: CreateBookingInput) {
  const pkg = getPackage(input.packageId);
  if (!pkg) throw ApiError.badRequest("Unknown package");

  // Price is computed server-side — never trusted from the client.
  const price = priceFor(input.vehicleType, pkg);

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
    price,
    status: "upcoming",
  });

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
