import crypto from "node:crypto";
import { env, paymentsLive } from "../../config/env";

export { paymentsLive };
export const razorpayKeyId = env.razorpayKeyId;

/** Synthetic order id for mock (no-keys dev) mode. */
export function mockOrderId(prefix = "order_mock"): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

/** Lazily construct the Razorpay client only when live keys are configured. */
export async function getRazorpayClient() {
  const { default: Razorpay } = await import("razorpay");
  return new Razorpay({ key_id: env.razorpayKeyId, key_secret: env.razorpayKeySecret });
}

/** Create a Razorpay order for `amountRupees` (converted to paise). */
export async function createRazorpayOrder(amountRupees: number, receipt: string) {
  const rzp = await getRazorpayClient();
  return rzp.orders.create({ amount: amountRupees * 100, currency: "INR", receipt });
}

/**
 * Refund `amountRupees` against a captured payment (converted to paise).
 * Throws if Razorpay rejects it, so the caller can avoid marking a refund that
 * never actually left the account.
 */
export async function createRazorpayRefund(paymentId: string, amountRupees: number) {
  const rzp = await getRazorpayClient();
  return rzp.payments.refund(paymentId, { amount: Math.round(amountRupees * 100) });
}

/** HMAC-SHA256 verification of a Razorpay checkout signature. */
export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", env.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
}
