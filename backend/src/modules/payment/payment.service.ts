import { ApiError } from "../../shared/utils/ApiError";
import { createBooking, computePrice } from "../booking/booking.service";
import { Payment } from "./payment.model";
import { paymentsLive, createRazorpayOrder, verifyRazorpaySignature, razorpayKeyId, mockOrderId } from "./razorpay";
import type { CreateOrderInput, VerifyPaymentInput } from "./payment.validation";

/** Server-side authoritative amount for a booking (rupees), discount code applied if present. */
async function amountFor(userId: string, input: CreateOrderInput["booking"]): Promise<number> {
  const { price } = await computePrice(userId, input);
  return price;
}

/** Preview the price + discount for a booking draft, without creating an order. */
export async function previewAmount(
  userId: string,
  input: {
    vehicleType: CreateOrderInput["booking"]["vehicleType"];
    packageId: string;
    discountCode?: string;
    coinsToRedeem?: number;
  },
) {
  const { basePrice, price, discountAmount, discountCodeLabel, coinsRedeemed, coinDiscount } =
    await computePrice(userId, input);
  return { basePrice, price, discountAmount, discountCode: discountCodeLabel, coinsRedeemed, coinDiscount };
}

/** Create a payment order. In mock mode (no keys configured) returns a synthetic order id. */
export async function createOrder(userId: string, input: CreateOrderInput) {
  const amount = await amountFor(userId, input.booking);

  if (!paymentsLive) {
    const orderId = mockOrderId();
    await Payment.create({ user: userId, orderId, amount, status: "mock" });
    return { orderId, amount, currency: "INR", keyId: "", mock: true };
  }

  const order = await createRazorpayOrder(amount, `bk_${Date.now()}`);
  await Payment.create({ user: userId, orderId: order.id, amount, status: "created" });
  return { orderId: order.id, amount, currency: "INR", keyId: razorpayKeyId, mock: false };
}

/** Verify the Razorpay signature (live) then create the booking. */
export async function verifyAndBook(userId: string, input: VerifyPaymentInput) {
  if (paymentsLive) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = input;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw ApiError.badRequest("Missing payment confirmation fields");
    }
    if (!verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
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
