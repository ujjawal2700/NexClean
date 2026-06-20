import { Schema, model } from "mongoose";

/** Singleton pricing config, editable by admins. Seeded from the catalog. */
const pricingSchema = new Schema(
  {
    base: { type: Object, required: true }, // { hatchback: 299, ... }
    packages: {
      type: [{ id: String, name: String, factor: Number, durationMinutes: Number, active: Boolean }],
      default: [],
    },
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

export const Pricing = model("Pricing", pricingSchema);
