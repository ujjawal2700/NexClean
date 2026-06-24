import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const jsonTransform = {
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

const promoBannerSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: "", trim: true },
    imageUrl: { type: String, required: true, trim: true },
    ctaLabel: { type: String, default: "", trim: true },
    ctaLink: { type: String, default: "", trim: true },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: jsonTransform },
);

export type PromoBannerDoc = HydratedDocument<InferSchemaType<typeof promoBannerSchema>>;
export const PromoBanner = model("PromoBanner", promoBannerSchema);
