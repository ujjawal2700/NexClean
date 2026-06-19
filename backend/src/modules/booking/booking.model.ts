import { Schema, model, Types, type HydratedDocument, type InferSchemaType } from "mongoose";
import { VEHICLE_TYPES } from "../catalog/catalog.data";

const bookingSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },
    vehicleName: { type: String, required: true },
    packageId: { type: String, required: true },
    packageName: { type: String, required: true },
    date: { type: Date, required: true },
    slot: { type: String, required: true },
    addressLabel: { type: String, required: true },
    addressLine: { type: String, required: true },
    society: { type: String, default: "" },
    price: { type: Number, required: true },
    status: {
      type: String,
      enum: ["upcoming", "completed", "cancelled"],
      default: "upcoming",
      index: true,
    },

    // Agent fulfilment
    assignedAgent: { type: Types.ObjectId, ref: "User", default: null, index: true },
    agentName: { type: String, default: null },
    jobStatus: {
      type: String,
      enum: ["assigned", "enroute", "arrived", "in_progress", "completed"],
      default: "assigned",
    },
    hasBefore: { type: Boolean, default: false },
    hasAfter: { type: Boolean, default: false },
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

export type BookingDocument = HydratedDocument<InferSchemaType<typeof bookingSchema>>;
export const Booking = model("Booking", bookingSchema);
