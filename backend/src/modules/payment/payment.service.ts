import { ApiError } from "../../shared/utils/ApiError";
import { Types } from "mongoose";
import { createBooking, computePrice, type ComputedBookingPrice } from "../booking/booking.service";
import { Payment } from "./payment.model";
import { paymentsLive, createRazorpayOrder, verifyRazorpaySignature, razorpayKeyId, mockOrderId } from "./razorpay";
import type { CreateOrderInput, VerifyPaymentInput } from "./payment.validation";

/** Preview the price + discount for a booking draft, without creating an order. */
export async function previewAmount(
  userId: string,
  input: {
    vehicleType: CreateOrderInput["booking"]["vehicleType"];
    packageId: string;
    discountCode?: string;
    coinsToRedeem?: number;
    date?: string;
    slot?: string;
  },
) {
  const { basePrice, price, discountAmount, discountCodeLabel, coinsRedeemed, coinDiscount } =
    await computePrice(userId, input);
  return { basePrice, price, discountAmount, discountCode: discountCodeLabel, coinsRedeemed, coinDiscount };
}

/** Create a payment order. In cash/mock mode returns a synthetic order id. */
export async function createOrder(userId: string, input: CreateOrderInput) {
  const computed = await computePrice(userId, input.booking);
  // `pkg` originates as an embedded Mongoose subdocument. Flatten it before
  // putting it in a Mixed field so its virtual `id` is not lost on reload.
  const pricingSnapshot: ComputedBookingPrice = {
    ...computed,
    pkg: {
      id: computed.pkg.id,
      name: computed.pkg.name,
      factor: computed.pkg.factor,
      durationMinutes: computed.pkg.durationMinutes,
      active: computed.pkg.active,
    },
  };
  const amount = pricingSnapshot.price;

  if (input.expectedAmount !== undefined && Math.abs(input.expectedAmount - amount) > 0.009) {
    throw ApiError.conflict("The price has been updated. Review the new total before paying.", {
      code: "PRICE_CHANGED",
      expectedAmount: input.expectedAmount,
      currentAmount: amount,
    });
  }

  if (!paymentsLive) {
    const orderId = mockOrderId();
    await Payment.create({
      user: userId,
      orderId,
      amount,
      status: "mock",
      bookingDraft: input.booking,
      pricingSnapshot,
    });
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
    pricingSnapshot,
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
    if (input.razorpay_order_id) {
      // Reserve this order before creating anything so two rapid confirms
      // cannot turn one mock/cash order into two bookings.
      const reservationId = new Types.ObjectId();
      const payment = await Payment.findOneAndUpdate(
        { orderId: input.razorpay_order_id, user: userId, status: "mock", booking: null },
        { booking: reservationId },
        { new: true },
      );
      if (!payment) throw ApiError.badRequest("This order has already been used or does not belong to you");

      const draft = payment.bookingDraft as CreateOrderInput["booking"] | undefined;
      const snapshot = payment.pricingSnapshot as ComputedBookingPrice | undefined;
      if (!draft) {
        await Payment.updateOne({ _id: payment._id, booking: reservationId }, { booking: null });
        throw ApiError.badRequest("Payment order is missing its booking details");
      }
      try {
        const booking = await createBooking(userId, draft, snapshot);
        await Payment.updateOne({ _id: payment._id, booking: reservationId }, { booking: booking.id });
        return booking;
      } catch (err) {
        await Payment.updateOne({ _id: payment._id, booking: reservationId }, { booking: null });
        throw err;
      }
    } else {
      const booking = await createBooking(userId, input.booking);
      // Pay-to-cleaner: the app confirms the booking directly and never calls
      // /payments/order, so nothing used to be written here at all — the
      // booking existed but had no ledger entry, and Payments & Settlement
      // simply never listed it. Record the transaction now, as "created":
      // the cash is owed but not yet collected, and it flips to "paid" when
      // the cleaner completes the job (see markPaymentCollected).
      await Payment.create({
        user: userId,
        booking: booking.id,
        orderId: mockOrderId("cash"),
        amount: booking.price,
        status: "created",
        bookingDraft: input.booking,
      });
      return booking;
    }
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

  const snapshot = payment.pricingSnapshot as ComputedBookingPrice | undefined;
  if (snapshot && snapshot.price !== payment.amount) {
    throw ApiError.badRequest("Payment order has an invalid pricing snapshot");
  }
  const booking = await createBooking(userId, draft, snapshot);
  await Payment.updateOne({ _id: payment._id }, { booking: booking.id });
  return booking;
}
