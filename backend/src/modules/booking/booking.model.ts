import { Schema, model, Types, type HydratedDocument, type InferSchemaType } from "mongoose";
import { geoPointSchema } from "../../shared/geo";

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
    // Service location captured from the customer's address (Google Places). [lng, lat].
    location: { type: geoPointSchema(), default: undefined },
    price: { type: Number, required: true },
    discountCode: { type: String, default: null },
    discountAmount: { type: Number, default: 0 },
    // Coins the customer redeemed on this booking and the ₹ discount they bought.
    coinsRedeemed: { type: Number, default: 0 },
    coinDiscount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["upcoming", "completed", "cancelled"],
      default: "upcoming",
      index: true,
    },
    isSubscriptionWash: { type: Boolean, default: false },

    // Agent fulfilment
    assignedAgent: { type: Types.ObjectId, ref: "User", default: null, index: true },
    agentName: { type: String, default: null },
    assignedAt: { type: Date, default: null },
    jobStatus: {
      type: String,
      enum: ["assigned", "enroute", "arrived", "in_progress", "completed"],
      default: "assigned",
    },
    hasBefore: { type: Boolean, default: false },
    hasAfter: { type: Boolean, default: false },

    // Real-time dispatch pipeline
    dispatchStatus: {
      type: String,
      // scheduled  → subscription wash waiting for its day (auto-assigned nearest before the slot)
      // searching  → looking for a cleaner (sequential nearest-first offers)
      // offered    → an offer is currently out to `currentOfferAgent`
      // assigned   → a cleaner accepted / was assigned
      // pending_admin → radius exhausted, awaiting manual assignment
      // cancelled  → booking cancelled
      enum: ["scheduled", "searching", "offered", "assigned", "pending_admin", "cancelled"],
      default: "assigned",
      index: true,
    },
    currentOfferAgent: { type: Types.ObjectId, ref: "User", default: null },
    offerExpiresAt: { type: Date, default: null },
    declinedAgents: { type: [Types.ObjectId], default: [] },
    searchRadiusM: { type: Number, default: 0 },
    dispatchAttempts: { type: Number, default: 0 },

    // Auto-reschedule tracking
    rescheduleCount: { type: Number, default: 0 },
    lastRescheduledAt: { type: Date, default: null },
    autoRescheduled: { type: Boolean, default: false },
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

// Geospatial index so we can rank agents by distance from the service point.
bookingSchema.index({ location: "2dsphere" });

export type BookingDocument = HydratedDocument<InferSchemaType<typeof bookingSchema>>;
export const Booking = model("Booking", bookingSchema);
