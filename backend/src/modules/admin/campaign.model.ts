import { Schema, model } from "mongoose";

const campaignSchema = new Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    audience: { type: String, default: "All customers" },
    sentCount: { type: Number, default: 0 },
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

export const Campaign = model("Campaign", campaignSchema);
