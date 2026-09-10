import { z } from "zod";
import { createBookingSchema } from "../booking/booking.validation";
import { TIME_SLOTS, SLOT_LIST } from "../../shared/slots";

export const createOrderSchema = z.object({
  booking: createBookingSchema,
});

export const previewAmountSchema = z.object({
  vehicleType: z.string().min(1),
  packageId: z.string().min(1),
  discountCode: z.string().trim().min(1).optional(),
  coinsToRedeem: z.number().int().min(0).optional(),
  // The slot being quoted for. Optional so older clients keep working, but an
  // off-peak-only code presented without them is refused rather than quoted —
  // quoting a discount that booking creation would then reject is the one
  // outcome worth avoiding. Deliberately not bounded like createBookingSchema's
  // `date`: this is a read-only quote, and rejecting a past date here would
  // surface as a confusing "invalid date" on a screen the customer can't fix.
  date: z.string().datetime({ message: "date must be an ISO datetime" }).optional(),
  slot: z.enum(TIME_SLOTS, { errorMap: () => ({ message: `slot must be one of: ${SLOT_LIST}` }) }).optional(),
});

export const verifyPaymentSchema = z.object({
  booking: createBookingSchema,
  razorpay_order_id: z.string().optional(),
  razorpay_payment_id: z.string().optional(),
  razorpay_signature: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
