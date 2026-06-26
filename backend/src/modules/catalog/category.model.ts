import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const jsonTransform = {
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

/**
 * A vehicle category (e.g. "Hatchback"), admin-managed. `key` is the stable
 * identifier referenced by bookings, vehicles, pricing and plans — it's set
 * once at creation and never changes, even if the display name is renamed.
 */
const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true, lowercase: true, unique: true },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: jsonTransform },
);

export type VehicleCategoryDoc = HydratedDocument<InferSchemaType<typeof categorySchema>>;
export const VehicleCategory = model("VehicleCategory", categorySchema);
