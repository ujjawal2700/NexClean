import { Schema, model, Types, type HydratedDocument, type InferSchemaType } from "mongoose";
import { geoPointSchema } from "../../shared/geo";

const bookingSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    customerName: { type: String, default: null },
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

    /**
     * Off-peak subsidy, snapshotted at booking time.
     *
     * `offPeakLocked` marks a booking that only got its price because it was
     * placed in a quiet slot. Moving it into a peak slot later has to reclaim
     * that subsidy, otherwise a customer can buy the cheap slot and walk the
     * booking over to the expensive one.
     *
     * `offPeakDiscountAmount` is the rupees that subsidy was worth, and it is
     * stored rather than recomputed for two reasons: the coupon may be edited or
     * deleted before the reschedule happens, and a percentage coupon recomputed
     * against a changed base price would reclaim a different number than the
     * customer was ever given. Only the off-peak-gated portion goes in here —
     * general coupons and redeemed coins are excluded by construction, so they
     * can never be clawed back.
     *
     * Bookings created before this shipped have neither field; the defaults make
     * them unlocked, which is deliberate — they move freely and are never
     * charged for a rule that did not exist when they were made.
     */
    offPeakLocked: { type: Boolean, default: false },
    offPeakDiscountAmount: { type: Number, default: 0 },

    /**
     * Fee collected for moving this booking into a peak slot.
     *
     * Kept apart from `price` on purpose: the cleaner's payout is a percentage
     * of `price`, and this is a platform charge for the disruption, not service
     * revenue. Folding it into `price` would quietly raise what the cleaner
     * earns for identical work. It is also never refunded, so cancellation has
     * to be able to tell the two apart.
     */
    peakUpgradeFeeCharged: { type: Number, default: 0 },

    /**
     * An admin let a peak upgrade through without charging for it.
     *
     * Recorded rather than silently applied: waiving is a goodwill decision with
     * a rupee value, and "why is this booking in a peak slot at the off-peak
     * price?" needs an answer that is not guesswork.
     */
    upgradeWaivedAmount: { type: Number, default: 0 },
    upgradeWaivedBy: { type: Types.ObjectId, ref: "User", default: null },
    upgradeWaivedAt: { type: Date, default: null },

    /**
     * How many times the *customer* has moved this booking. Separate from
     * `rescheduleCount`, which the missed-slot sweep owns and resets — mixing
     * them would let a customer's moves exhaust the sweep's retry budget, or a
     * sweep reset hand back unlimited customer moves.
     */
    customerRescheduleCount: { type: Number, default: 0 },
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
    /**
     * When the cleaner actually started and finished the wash.
     *
     * jobStatus records where a job is but not when it got there, so the time
     * a wash took could not be reported at all — only 'assigned' had a
     * timestamp. Recorded at the transition rather than derived from
     * updatedAt, which any later edit to the booking would overwrite.
     * Bookings that completed before this shipped have neither, and are shown
     * as unknown rather than guessed at.
     */
    jobStartedAt: { type: Date, default: null },
    jobCompletedAt: { type: Date, default: null },
    hasBefore: { type: Boolean, default: false },
    hasAfter: { type: Boolean, default: false },
    // What the cleaner actually earned, frozen at the moment the job completed.
    // The payout rule is admin-editable, so computing it live would silently
    // rewrite the earnings history of every past job the next time the rate
    // changed. null = not completed yet, so quote it from the current rule.
    agentPayout: { type: Number, default: null },
    // The actual proof-of-service images (up to 8 before and 8 after).
    beforePhotos: { type: [String], default: [] },
    afterPhotos: { type: [String], default: [] },
    beforePhotoUrl: { type: String, default: "" },
    afterPhotoUrl: { type: String, default: "" },

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
    // Index into this booking's ordered dispatch tier list (zones nearest to
    // farthest, then a flat-radius catch-all) — see dispatch/dispatch.query.ts
    // buildDispatchTiers. Persisted so a resumed/retried search continues from
    // where it left off instead of restarting at the nearest zone every sweep.
    dispatchTierIndex: { type: Number, default: 0 },
    dispatchAttempts: { type: Number, default: 0 },

    // Auto-reschedule tracking
    rescheduleCount: { type: Number, default: 0 },
    lastRescheduledAt: { type: Date, default: null },
    autoRescheduled: { type: Boolean, default: false },

    /**
     * Which pre-service reminder pushes ("60m" | "30m" | "5m") have already
     * gone out for this booking's current slot. The reminder sweep runs on a
     * short tick and re-derives "is a window due?" from the clock every time,
     * so without a persisted marker a slow tick or a restart would re-fire a
     * reminder the customer already got. Rescheduling clears it (a new slot
     * time means the old windows no longer apply).
     */
    remindersSent: { type: [String], default: [] },
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
// Backs the dashboard counters and the admin booking lists, which filter on
// exactly these two fields.
bookingSchema.index({ status: 1, jobStatus: 1 });

export type BookingDocument = HydratedDocument<InferSchemaType<typeof bookingSchema>>;
export const Booking = model("Booking", bookingSchema);
