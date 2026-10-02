import { Schema, model, Types, type HydratedDocument, type InferSchemaType } from "mongoose";

export const REFUND_STATUSES = ["pending", "processing", "approved", "rejected"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

/**
 * A refund owed because a booking was cancelled, waiting for an admin to send
 * or decline it. One per booking.
 *
 * It splits by where the money came from: `lines` are online payments, each
 * returned to its original method through the gateway; `coins` were redeemed
 * from the wallet and go back to the wallet. A booking paid ₹100 online and
 * ₹100 in coins therefore refunds ₹100 to the card/UPI and 100 coins.
 */
const refundRequestSchema = new Schema(
  {
    booking: { type: Types.ObjectId, ref: "Booking", required: true, unique: true },
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    cancelledBy: { type: String, enum: ["customer", "admin"], required: true },
    lines: {
      type: [
        new Schema(
          {
            payment: { type: Types.ObjectId, ref: "Payment", required: true },
            amount: { type: Number, required: true, min: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    /** Total to return to the original payment method, in rupees. */
    amount: { type: Number, required: true, min: 0, default: 0 },
    /** Coins to return to the wallet. */
    coins: { type: Number, required: true, min: 0, default: 0 },
    status: { type: String, enum: REFUND_STATUSES, default: "pending", index: true },
    decidedBy: { type: Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
    /** Admin's reason when declining. */
    note: { type: String, default: "" },
    /** Why the last approval attempt failed (e.g. the gateway refused). */
    lastError: { type: String, default: "" },
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

export type RefundRequestDoc = HydratedDocument<InferSchemaType<typeof refundRequestSchema>>;
export const RefundRequest = model("RefundRequest", refundRequestSchema);
