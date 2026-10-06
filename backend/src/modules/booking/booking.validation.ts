import { z } from "zod";
import { isValidSlot } from "../../shared/slots";
import { HEX_COLOR } from "../user/user.validation";

export const createBookingSchema = z.object({
  vehicleType: z.string().min(1),
  vehicleName: z.string().min(1).max(60),
  vehiclePlate: z.string().trim().max(20).optional(),
  vehicleColor: z.string().trim().max(30).optional(),
  vehicleColorHex: z.string().regex(HEX_COLOR, "Pick a valid colour").optional(),
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
  slot: z.string().refine(isValidSlot, { message: "That time slot is no longer available. Please pick another." }),
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

/**
 * Moving an existing booking. The date is bounded on the upper side only —
 * `assertSlotHasNotice` owns the lead-time rule, so it can explain
 * "pick one at least an hour from now" rather than this returning a flat
 * "invalid date" the customer cannot act on.
 */
export const rescheduleBookingSchema = z.object({
  date: z
    .string()
    .datetime({ message: "date must be an ISO datetime" })
    .refine((v) => Date.parse(v) <= Date.now() + 365 * 24 * 60 * 60 * 1000, {
      message: "Booking date is too far in the future",
    }),
  slot: z.string().refine(isValidSlot, { message: "That time slot is no longer available. Please pick another." }),
  /** How the customer settles anything owed. Omit when nothing is due. */
  paymentMethod: z.enum(["cash", "online"]).optional(),
  // Proof for the online route, carried straight from the gateway callback.
  razorpay_order_id: z.string().optional(),
  razorpay_payment_id: z.string().optional(),
  razorpay_signature: z.string().optional(),
});

export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;
