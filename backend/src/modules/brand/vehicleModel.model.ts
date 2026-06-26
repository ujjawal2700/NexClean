import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from "mongoose";

const jsonTransform = {
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

/**
 * A specific model under a brand (e.g. Hyundai "Creta"), carrying its own
 * vehicle category — this is what lets the customer pick a brand + model
 * and have the category auto-derived, instead of picking it manually.
 */
const vehicleModelSchema = new Schema(
  {
    brand: { type: Types.ObjectId, ref: "VehicleBrand", required: true, index: true },
    name: { type: String, required: true, trim: true },
    categoryKey: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: jsonTransform },
);

vehicleModelSchema.index({ brand: 1, name: 1 }, { unique: true });

export type VehicleModelDoc = HydratedDocument<InferSchemaType<typeof vehicleModelSchema>>;
export const VehicleModel = model("VehicleModel", vehicleModelSchema);
