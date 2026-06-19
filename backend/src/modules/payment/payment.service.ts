import crypto from "node:crypto";
import { env, paymentsLive } from "../../config/env";
import { ApiError } from "../../shared/utils/ApiError";
import { getPrice } from "../pricing/pricing.service";
import { createBooking } from "../booking/booking.service";
import { Payment } from "./payment.model";
import type { CreateOrderInput, VerifyPaymentInput } from "./payment.validation";

/** Server-side authoritative amount for a booking (rupees). */
function amountFor(input: CreateOrderInput["booking"]): Promise<number> {
  return getPrice(input.vehicleType, input.packageId);
}

// Lazily construct the Razorpay client only when live keys are configured.
async function getRazorpay() {
  const { default: Razorpay } = await import("razorpay");
  return new Razorpay({ key_id: env.razorpayKeyId, key_secret: env.razorpayKeySecret });
}

/** Create a payment order. In mock mode returns a synthetic order id. */
export async function createOrder(userId: string, input: CreateOrderInput) {
  const amount = await amountFor(input.booking);

  if (!paymentsLive) {
    const orderId = `order_mock_${crypto.randomBytes(8).toString("hex")}`;
    await Payment.create({ user: userId, orderId, amount, status: "mock" });
    return { orderId, amount, currency: "INR", keyId: "", mock: true };
  }

  const rzp = await getRazorpay();
  const order = await rzp.orders.create({
    amount: amount * 100, // paise
    currency: "INR",
    receipt: `bk_${Date.now()}`,
  });
  await Payment.create({ user: userId, orderId: order.id, amount, status: "created" });
  return { orderId: order.id, amount, currency: "INR", keyId: env.razorpayKeyId, mock: false };
}

/** Verify the Razorpay signature (live) then create the booking. */
export async function verifyAndBook(userId: string, input: VerifyPaymentInput) {
  if (paymentsLive) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = input;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw ApiError.badRequest("Missing payment confirmation fields");
    }
    const expected = crypto
      .createHmac("sha256", env.razorpayKeySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (expected !== razorpay_signature) {
      throw ApiError.badRequest("Payment signature verification failed");
    }
    await Payment.findOneAndUpdate(
      { orderId: razorpay_order_id },
      { paymentId: razorpay_payment_id, status: "paid" },
    );
  }

  const booking = await createBooking(userId, input.booking);

  if (input.razorpay_order_id) {
    await Payment.findOneAndUpdate({ orderId: input.razorpay_order_id }, { booking: booking.id });
  }

  return booking;
}
