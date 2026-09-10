import { Schema, model, Types, type HydratedDocument, type InferSchemaType } from "mongoose";

/**
 * An agent's request to cash out their earned-but-unpaid balance.
 *
 * `bankSnapshot` copies the agent's bank details as they stood when the
 * request was made, rather than reading `User.bankAccount` live at payout
 * time — an agent editing their account after requesting must not silently
 * redirect money already in an admin's approval queue. Full account number
 * on purpose: whoever processes this (an admin, manually, outside the app)
 * needs it to actually send the money, unlike the agent-facing history view
 * which only ever shows the account back masked.
 */
const payoutRequestSchema = new Schema(
  {
    agent: { type: Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "paid"],
      default: "pending",
      index: true,
    },
    bankSnapshot: {
      type: new Schema(
        {
          holderName: { type: String, required: true },
          bankName: { type: String, required: true },
          accountNumber: { type: String, required: true },
          ifsc: { type: String, required: true },
          branch: { type: String, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    rejectionReason: { type: String, default: "" },
    transactionRef: { type: String, default: "" },
    processedBy: { type: Types.ObjectId, ref: "User", default: null },
    processedAt: { type: Date, default: null },
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

payoutRequestSchema.index({ agent: 1, status: 1 });

export type PayoutRequestDocument = HydratedDocument<InferSchemaType<typeof payoutRequestSchema>>;
export const PayoutRequest = model("PayoutRequest", payoutRequestSchema);
