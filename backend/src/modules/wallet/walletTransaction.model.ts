import { Schema, model, Types, type HydratedDocument, type InferSchemaType } from "mongoose";

/** Reasons a user's coin balance moves. Positive `coins` credit, negative debit. */
export const WALLET_TX_TYPES = ["referral_welcome", "referral_reward", "redeem"] as const;
export type WalletTxType = (typeof WALLET_TX_TYPES)[number];

/**
 * Append-only ledger of every coin movement. `balanceAfter` snapshots the
 * user's coin balance immediately after this transaction for cheap history rendering.
 */
const walletTransactionSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: WALLET_TX_TYPES, required: true },
    // Signed coin delta: credits are positive, redemptions negative.
    coins: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    note: { type: String, default: "" },
    // Optional links for context (e.g. the referee that triggered a reward, or the redeemed booking).
    relatedUser: { type: Types.ObjectId, ref: "User", default: null },
    relatedBooking: { type: Types.ObjectId, ref: "Booking", default: null },
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

export type WalletTransactionDoc = HydratedDocument<InferSchemaType<typeof walletTransactionSchema>>;
export const WalletTransaction = model("WalletTransaction", walletTransactionSchema);
