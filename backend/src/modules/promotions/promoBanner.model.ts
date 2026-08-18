import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const jsonTransform = {
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

/** What a banner is *about*, so the customer app can badge it and the admin list
 *  can be scanned at a glance. Purely presentational — it does not gate display. */
export const BANNER_TYPES = ["promotional", "discount", "off-peak-hours", "announcement"] as const;
export type BannerType = (typeof BANNER_TYPES)[number];

const promoBannerSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: "", trim: true },
    imageUrl: { type: String, required: true, trim: true },
    ctaLabel: { type: String, default: "", trim: true },
    ctaLink: { type: String, default: "", trim: true },
    type: { type: String, enum: BANNER_TYPES, default: "promotional" },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: jsonTransform },
);

export type PromoBannerDoc = HydratedDocument<InferSchemaType<typeof promoBannerSchema>>;
export const PromoBanner = model("PromoBanner", promoBannerSchema);
