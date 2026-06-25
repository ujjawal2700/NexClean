import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { VEHICLE_TYPES } from "../catalog/catalog.data";

const jsonTransform = {
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

/**
 * A car brand (e.g. "Hyundai") with the specific models customers can pick
 * under it (e.g. "i10", "Creta"), scoped to one vehicle type. Pricing is
 * driven entirely by vehicleType — brand/model are descriptive only.
 */
const brandSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },
    models: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: jsonTransform },
);

// A brand name can repeat across vehicle types (e.g. Maruti under both
// hatchback and sedan) but not twice within the same type.
brandSchema.index({ name: 1, vehicleType: 1 }, { unique: true });

export type VehicleBrandDoc = HydratedDocument<InferSchemaType<typeof brandSchema>>;
export const VehicleBrand = model("VehicleBrand", brandSchema);
