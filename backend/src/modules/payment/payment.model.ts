import { Schema, model, Types, type HydratedDocument, type InferSchemaType } from "mongoose";

const paymentSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    customerName: { type: String, default: null },
    booking: { type: Types.ObjectId, ref: "Booking" },
    orderId: { type: String, required: true },
    paymentId: { type: String, default: null },
    amount: { type: Number, required: true }, // in rupees
    currency: { type: String, default: "INR" },
    // The booking payload exactly as priced when this order was created. The
    // booking is rebuilt from this on verify, so a client cannot swap in a
    // costlier package after paying for a cheaper one.
    bookingDraft: { type: Schema.Types.Mixed, default: null },
    status: { type: String, enum: ["created", "paid", "mock", "refunded"], default: "created", index: true },

    /**
     * What this row is for. "booking" is the service itself; "reschedule" is an
     * upcharge for moving a discounted booking into a peak slot. Kept distinct
     * because the two behave differently on refund — the upgrade fee inside a
     * reschedule row is never returned.
     */
    kind: { type: String, enum: ["booking", "reschedule"], default: "booking", index: true },

    /**
     * The exact move this upcharge was quoted for.
     *
     * Binding the slot to the order is what stops a customer paying for a cheap
     * upgrade and then applying it to a different, dearer slot: on verify the
     * requested move must match what was paid for, or the payment buys nothing.
     * Same reasoning as `bookingDraft` above, one level down.
     */
    rescheduleIntent: {
      type: new Schema(
        {
          date: { type: Date, required: true },
          slot: { type: String, required: true },
          reclaim: { type: Number, required: true },
          fee: { type: Number, required: true },
          totalDue: { type: Number, required: true },
        },
        { _id: false },
      ),
      default: null,
    },

    // Refund handling
    refundAmount: { type: Number, default: 0 },
    refundedAt: { type: Date, default: null },
    refundReason: { type: String, default: "" },

    // Agent settlement (payout owed to the assigned agent for this payment)
    agentPayout: { type: Number, default: 0 },
    settlementStatus: { type: String, enum: ["pending", "settled"], default: "pending", index: true },
    settledAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export type PaymentDocument = HydratedDocument<InferSchemaType<typeof paymentSchema>>;
export const Payment = model("Payment", paymentSchema);
