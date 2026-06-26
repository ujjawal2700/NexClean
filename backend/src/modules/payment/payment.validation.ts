import { z } from "zod";
import { createBookingSchema } from "../booking/booking.validation";

export const createOrderSchema = z.object({
  booking: createBookingSchema,
});

export const previewAmountSchema = z.object({
  vehicleType: z.string().min(1),
  packageId: z.string().min(1),
  discountCode: z.string().trim().min(1).optional(),
});

export const verifyPaymentSchema = z.object({
  booking: createBookingSchema,
  razorpay_order_id: z.string().optional(),
  razorpay_payment_id: z.string().optional(),
  razorpay_signature: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
