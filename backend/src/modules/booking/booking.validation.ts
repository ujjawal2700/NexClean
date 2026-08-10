import { z } from "zod";
import { TIME_SLOTS, SLOT_LIST } from "../../shared/slots";

export const createBookingSchema = z.object({
  vehicleType: z.string().min(1),
  vehicleName: z.string().min(1).max(60),
  packageId: z.string().min(1),
  // Bounded on both sides: a back-dated job would enter dispatch and sit in the
  // schedule for a slot that has already gone, and there is no reason to accept
  // one years out. A day of slack on the lower bound covers timezone skew
  // between the client's clock and the server's.
  date: z
    .string()
    .datetime({ message: "date must be an ISO datetime" })
    .refine((v) => Date.parse(v) >= Date.now() - 24 * 60 * 60 * 1000, {
      message: "Booking date cannot be in the past",
    })
    .refine((v) => Date.parse(v) <= Date.now() + 365 * 24 * 60 * 60 * 1000, {
      message: "Booking date is too far in the future",
    }),
  slot: z.enum(TIME_SLOTS, { errorMap: () => ({ message: `slot must be one of: ${SLOT_LIST}` }) }),
  addressLabel: z.string().min(1),
  addressLine: z.string().min(1),
  discountCode: z.string().trim().min(1).optional(),
  // Coins the customer chose to redeem as a checkout discount (server re-validates & clamps).
  coinsToRedeem: z.number().int().min(0).optional(),
  // Service-location geo, captured from Google Places on the client. Optional so
  // older clients still work — a booking without coords routes to the admin queue.
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
