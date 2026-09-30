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

/**
 * Moving an existing booking. The date is bounded on the upper side only —
 * `assertCustomerMayReschedule` owns the lead-time rule, so it can explain
 * "pick a slot at least an hour from now" rather than this returning a flat
 * "invalid date" the customer cannot act on.
 */
export const rescheduleBookingSchema = z.object({
  date: z
    .string()
    .datetime({ message: "date must be an ISO datetime" })
    .refine((v) => Date.parse(v) <= Date.now() + 365 * 24 * 60 * 60 * 1000, {
      message: "Booking date is too far in the future",
    }),
  slot: z.enum(TIME_SLOTS, { errorMap: () => ({ message: `slot must be one of: ${SLOT_LIST}` }) }),
  /** How the customer settles anything owed. Omit when nothing is due. */
  paymentMethod: z.enum(["cash", "online"]).optional(),
  // Proof for the online route, carried straight from the gateway callback.
  razorpay_order_id: z.string().optional(),
  razorpay_payment_id: z.string().optional(),
  razorpay_signature: z.string().optional(),
});

export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;
