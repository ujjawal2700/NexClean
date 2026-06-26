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
 * A car brand (e.g. "Hyundai"). Not scoped to a vehicle category — a single
 * brand sells cars across many categories. Each specific model (under
 * VehicleModel) carries its own category.
 */
const brandSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: jsonTransform },
);

export type VehicleBrandDoc = HydratedDocument<InferSchemaType<typeof brandSchema>>;
export const VehicleBrand = model("VehicleBrand", brandSchema);
