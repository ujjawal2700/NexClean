import { Schema, model, Types, type HydratedDocument, type InferSchemaType } from "mongoose";

const paymentSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    booking: { type: Types.ObjectId, ref: "Booking" },
    orderId: { type: String, required: true },
    paymentId: { type: String, default: null },
    amount: { type: Number, required: true }, // in rupees
    currency: { type: String, default: "INR" },
    status: { type: String, enum: ["created", "paid", "mock", "refunded"], default: "created", index: true },

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
