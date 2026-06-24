import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const jsonTransform = {
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

const referralCampaignSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    referrerReward: { type: Number, required: true, min: 0 },
    refereeReward: { type: Number, required: true, min: 0 },
    description: { type: String, default: "", trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: jsonTransform },
);

export type ReferralCampaignDoc = HydratedDocument<InferSchemaType<typeof referralCampaignSchema>>;
export const ReferralCampaign = model("ReferralCampaign", referralCampaignSchema);
