import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

/**
 * Single, global rule for what a cleaner earns on a job (there is only ever one).
 *
 * This used to be a hardcoded `price * 0.7` scattered across the agent, dispatch
 * and payment code, so changing the commercial split meant a code deploy and it
 * was easy for one of those call sites to drift out of step with the others.
 */
const payoutConfigSchema = new Schema(
  {
    _id: { type: String, default: "global" },
    // "percent" → a share of the booking price. "flat" → the same amount per job.
    mode: { type: String, enum: ["percent", "flat"], default: "percent" },
    // Used when mode is "percent". 70 means the cleaner keeps 70% of the price.
    percent: { type: Number, required: true, min: 0, max: 100, default: 70 },
    // Used when mode is "flat". A fixed ₹ amount per completed job.
    flatAmount: { type: Number, required: true, min: 0, default: 0 },
    // Floor applied after the rule. Protects the cleaner on heavily discounted
    // jobs, where a straight percentage can leave the work barely paid.
    minPayout: { type: Number, required: true, min: 0, default: 0 },
    // Optional ceiling. 0 means "no cap" — a cap of ₹0 would never be intended.
    maxPayout: { type: Number, required: true, min: 0, default: 0 },
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

export type PayoutConfigDoc = HydratedDocument<InferSchemaType<typeof payoutConfigSchema>>;
export const PayoutConfig = model("PayoutConfig", payoutConfigSchema);
