import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

/**
 * Single, global referral program configuration (there is only ever one).
 * Rewards are denominated in coins; `coinsPerRupee` converts coins to a ₹ value
 * when they are redeemed as a checkout discount.
 */
const referralConfigSchema = new Schema(
  {
    _id: { type: String, default: "global" },
    // Coins credited to the referrer once their referee completes a first service / subscribes.
    referrerReward: { type: Number, required: true, min: 0, default: 100 },
    // Welcome coins credited to a new user who signs up with a valid referral code.
    refereeReward: { type: Number, required: true, min: 0, default: 50 },
    // Conversion rate: how many coins equal ₹1 (e.g. 2 → ₹1 = 2 coins).
    coinsPerRupee: { type: Number, required: true, min: 1, default: 1 },
    // Cap on how much of an order value coins may cover, as a percentage (0–100).
    maxRedeemPercent: { type: Number, required: true, min: 0, max: 100, default: 100 },
    // Master switch for the whole referral program.
    active: { type: Boolean, default: true },
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

export type ReferralConfigDoc = HydratedDocument<InferSchemaType<typeof referralConfigSchema>>;
export const ReferralConfig = model("ReferralConfig", referralConfigSchema);
