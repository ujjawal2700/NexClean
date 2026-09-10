import { Payment } from "./payment.model";
import { ApiError } from "../../shared/utils/ApiError";
import { createRazorpayOrder, verifyRazorpaySignature, razorpayKeyId, paymentsLive } from "./razorpay";

/**
 * Writes to the payments ledger that other modules need.
 *
 * Deliberately its own module, importing nothing but the model. These used to
 * live in payment.service, which imports booking.service — so booking.service
 * calling back into it closed an import cycle. CommonJS tolerates that as long
 * as nothing is used at module-initialisation time, which makes it the kind of
 * dependency that works until someone adds a top-level call and it fails with
 * an undefined function in production.
 */

/**
 * Mark a booking's cash payment as collected.
 *
 * In pay-to-cleaner mode the money changes hands when the cleaner finishes the
 * job, so that is the moment the ledger row becomes "paid" — which is also what
 * makes it settleable and refundable (both admin actions hard-require "paid")
 * and what feeds the Gross collections tile. Only ever promotes a "created"
 * row: a refunded or already-paid payment must not be dragged backwards by a
 * repeated completion call.
 */
export async function markPaymentCollected(bookingId: string): Promise<void> {
  await Payment.updateOne(
    { booking: bookingId, status: "created" },
    { status: "paid", paymentId: `cash_${bookingId}` },
  );
}

/**
 * Keep a booking's uncollected ledger row in step with what is now owed.
 *
 * Only touches a row still at "created" — once the cash has been collected the
 * amount is history, and a reschedule cannot rewrite what was already taken.
 */
export async function syncCashLedgerAmount(bookingId: string, amount: number): Promise<void> {
  await Payment.updateOne({ booking: bookingId, kind: "booking", status: "created" }, { amount });
}

export type RescheduleIntent = {
  date: Date;
  slot: string;
  reclaim: number;
  fee: number;
  totalDue: number;
};

/** Is paying online actually possible right now? Drives whether the UI offers it. */
export function onlinePaymentAvailable(): boolean {
  return paymentsLive;
}

/**
 * Open a gateway order for a reschedule upcharge.
 *
 * The quoted move is stored on the row, not just its price. Without that a
 * customer could pay ₹250 for one upgrade and present the receipt against a
 * different, dearer slot — the same substitution `bookingDraft` guards against
 * at booking time.
 */
export async function createRescheduleOrder(
  userId: string,
  bookingId: string,
  intent: RescheduleIntent,
): Promise<{ orderId: string; amount: number; currency: string; keyId: string }> {
  if (!paymentsLive) {
    throw ApiError.badRequest("Online payment isn't available right now — choose to pay your cleaner instead");
  }
  const order = await createRazorpayOrder(intent.totalDue, `rs_${Date.now()}`);
  await Payment.create({
    user: userId,
    booking: bookingId,
    orderId: order.id,
    amount: intent.totalDue,
    status: "created",
    kind: "reschedule",
    rescheduleIntent: intent,
  });
  return { orderId: order.id, amount: intent.totalDue, currency: "INR", keyId: razorpayKeyId };
}

/**
 * Verify and consume a reschedule payment, returning the move it paid for.
 *
 * Claimed with a conditional update so one payment can only ever move one
 * booking: a Razorpay signature stays valid on replay and says nothing about
 * *what* was bought, so re-presenting it must find nothing left to claim.
 */
export async function claimReschedulePayment(
  userId: string,
  bookingId: string,
  proof: { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string },
): Promise<RescheduleIntent> {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = proof;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw ApiError.badRequest("Missing payment confirmation fields");
  }
  if (!verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    throw ApiError.badRequest("Payment signature verification failed");
  }

  const payment = await Payment.findOneAndUpdate(
    {
      orderId: razorpay_order_id,
      user: userId,
      booking: bookingId,
      kind: "reschedule",
      status: { $ne: "paid" },
    },
    { paymentId: razorpay_payment_id, status: "paid" },
    { new: true },
  );
  if (!payment) {
    throw ApiError.badRequest("This payment has already been used or does not belong to this booking");
  }

  const intent = payment.rescheduleIntent as RescheduleIntent | null;
  if (!intent) throw ApiError.badRequest("This payment is missing the change it was made for");
  return intent;
}
