import { Schema, model, Types, type HydratedDocument, type InferSchemaType } from "mongoose";

const bookingSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    // Vehicle category key — admin-managed, not a fixed enum.
    vehicleType: { type: String, required: true },
    vehicleName: { type: String, required: true },
    packageId: { type: String, required: true },
    packageName: { type: String, required: true },
    date: { type: Date, required: true },
    slot: { type: String, required: true },
    addressLabel: { type: String, required: true },
    addressLine: { type: String, required: true },
    society: { type: String, default: "" },
    price: { type: Number, required: true },
    discountCode: { type: String, default: null },
    discountAmount: { type: Number, default: 0 },
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
