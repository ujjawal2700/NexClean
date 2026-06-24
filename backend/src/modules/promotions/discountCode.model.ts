import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const jsonTransform = {
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

const discountCodeSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    type: { type: String, enum: ["percent", "flat"], required: true },
    value: { type: Number, required: true, min: 0 },
    minOrderValue: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: null },
    usageLimit: { type: Number, default: null },
    usageCount: { type: Number, default: 0 },
    validTill: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: jsonTransform },
);

export type DiscountCodeDoc = HydratedDocument<InferSchemaType<typeof discountCodeSchema>>;
export const DiscountCode = model("DiscountCode", discountCodeSchema);
