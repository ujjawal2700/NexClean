import { z } from "zod";

export const subscribeSchema = z.object({
  planId: z.string().min(1),
  vehicleType: z.string().min(1).optional(),
  coinsToRedeem: z.number().int().min(0).optional(),
});

export const previewSubscriptionSchema = subscribeSchema;

/** Order creation uses the same fields as a plain subscribe. */
export const subscriptionOrderSchema = subscribeSchema;

/** Verify carries the plan fields plus the Razorpay checkout response. */
export const verifySubscriptionSchema = subscribeSchema.extend({
  razorpay_order_id: z.string().optional(),
  razorpay_payment_id: z.string().optional(),
  razorpay_signature: z.string().optional(),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;
