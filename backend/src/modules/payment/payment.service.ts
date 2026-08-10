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

/** Create a payment order. In cash/mock mode returns a synthetic order id. */
export async function createOrder(userId: string, input: CreateOrderInput) {
  const amount = await amountFor(userId, input.booking);

  if (!paymentsLive) {
    const orderId = mockOrderId();
    await Payment.create({ user: userId, orderId, amount, status: "mock", bookingDraft: input.booking });
    return { orderId, amount, currency: "INR", keyId: "", mock: true };
  }

  const order = await createRazorpayOrder(amount, `bk_${Date.now()}`);
  // The priced draft is stored with the order so the booking that gets created
  // on verify is the one the customer was actually charged for.
  await Payment.create({
    user: userId,
    orderId: order.id,
    amount,
    status: "created",
    bookingDraft: input.booking,
  });
  return { orderId: order.id, amount, currency: "INR", keyId: razorpayKeyId, mock: false };
}

/**
 * Confirm a booking.
 *
 * In pay-to-cleaner mode (the default) there is no gateway step — the customer
 * confirms in the app and pays the cleaner on completion.
 *
 * With online payments enabled, the Razorpay signature is verified and the
 * order is consumed atomically. Two things matter here and both were previously
 * missing: the signature only covers `order_id|payment_id`, so it stays valid
 * on replay and says nothing about *what* was bought. Hence (a) the order is
 * claimed with a conditional update so it can only ever produce one booking,
 * and (b) the booking is built from the draft priced at order time, never from
 * the payload sent alongside the signature.
 */
export async function verifyAndBook(userId: string, input: VerifyPaymentInput) {
  if (!paymentsLive) {
    const booking = await createBooking(userId, input.booking);
    // Link the order record to the booking it produced, so the admin payments
    // list can still show which booking a (cash/mock) payment belongs to.
    if (input.razorpay_order_id) {
      await Payment.updateOne(
        { orderId: input.razorpay_order_id, user: userId },
        { booking: booking.id },
      );
    }
    return booking;
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = input;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw ApiError.badRequest("Missing payment confirmation fields");
  }
  if (!verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    throw ApiError.badRequest("Payment signature verification failed");
  }

  // Claim the order. The `status: { $ne: "paid" }` guard is what makes a
  // payment single-use: a replayed (still perfectly valid) signature finds
  // nothing left to claim and is rejected instead of minting another booking.
  const payment = await Payment.findOneAndUpdate(
    { orderId: razorpay_order_id, user: userId, status: { $ne: "paid" }, booking: null },
    { paymentId: razorpay_payment_id, status: "paid" },
    { new: true },
  );
  if (!payment) {
    throw ApiError.badRequest("This payment has already been used or does not belong to you");
  }

  const draft = payment.bookingDraft as CreateOrderInput["booking"] | undefined;
  if (!draft) {
    throw ApiError.badRequest("Payment order is missing its booking details");
  }

  const booking = await createBooking(userId, draft);
  await Payment.updateOne({ _id: payment._id }, { booking: booking.id });
  return booking;
}
