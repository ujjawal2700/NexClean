import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

/**
 * One peak window on one weekday, as 24h "HH:MM" wall-clock strings interpreted
 * in the config's timezone.
 *
 * Stored as strings rather than minute integers so the stored document stays
 * readable in the shell and in exports; the service converts to minutes for
 * every comparison. `label` is optional admin-facing copy ("Sunday morning
 * rush") that also feeds the customer-facing explanation of why a coupon
 * did or didn't apply.
 */
const peakWindowSchema = new Schema(
  {
    // 0 = Sunday, matching JS Date#getDay so no mapping table is needed anywhere.
    day: { type: Number, required: true, min: 0, max: 6 },
    start: { type: String, required: true, trim: true },
    end: { type: String, required: true, trim: true },
    label: { type: String, default: "", trim: true },
  },
  { _id: false },
);

/**
 * Single global peak-hours configuration (there is only ever one), mirroring the
 * ReferralConfig singleton pattern.
 */
const peakHoursConfigSchema = new Schema(
  {
    _id: { type: String, default: "global" },
    /**
     * IANA zone every window is interpreted in. Without this the meaning of
     * "08:00" would drift with whatever timezone the server happens to boot in.
     */
    timezone: { type: String, required: true, default: "Asia/Kolkata", trim: true },
    windows: { type: [peakWindowSchema], default: [] },
    /**
     * Master switch. Turning it off makes isPeakSlot() always false, which
     * deactivates every peak-only coupon at once without deleting the windows —
     * the admin equivalent of pausing rather than tearing down.
     */
    active: { type: Boolean, default: true },
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

export type PeakWindow = InferSchemaType<typeof peakWindowSchema>;
export type PeakHoursConfigDoc = HydratedDocument<InferSchemaType<typeof peakHoursConfigSchema>>;
export const PeakHoursConfig = model("PeakHoursConfig", peakHoursConfigSchema);
