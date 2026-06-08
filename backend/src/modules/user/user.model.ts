import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { VEHICLE_TYPES, PLANS } from "../catalog/catalog.data";

const vehicleSchema = new Schema(
  {
    type: { type: String, enum: VEHICLE_TYPES, required: true },
    name: { type: String, required: true, trim: true },
    plate: { type: String, default: "—", trim: true },
  },
  { _id: true },
);

const addressSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    line: { type: String, required: true, trim: true },
    society: { type: String, default: "", trim: true },
  },
  { _id: true },
);

const userSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: "NexClean Member", trim: true },
    role: { type: String, enum: ["customer", "agent", "admin"], default: "customer" },
    vehicles: { type: [vehicleSchema], default: [] },
    addresses: { type: [addressSchema], default: [] },
    activePlan: { type: String, enum: [...PLANS.map((p) => p.id), null], default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model("User", userSchema);
