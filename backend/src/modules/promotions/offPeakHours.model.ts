import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

/**
 * One off-peak window on one weekday, as 24h "HH:MM" wall-clock strings
 * interpreted in the config's timezone.
 *
 * Off-peak means *quiet*: the hours where demand is low and a discount is worth
 * offering to pull bookings in. Anything not covered by a window is peak, and is
 * sold at base price. That polarity matters — an empty config therefore means
 * "no discounts anywhere", which fails closed, rather than "everything is
 * discounted".
 *
 * Stored as strings rather than minute integers so the document stays readable
 * in the shell and in exports; the service converts to minutes for every
 * comparison. `label` is optional admin-facing copy ("Tuesday morning lull").
 */
const offPeakWindowSchema = new Schema(
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
 * Single global off-peak configuration (there is only ever one), mirroring the
 * ReferralConfig singleton pattern.
 *
 * NOTE: this model deliberately does not reuse the old "PeakHoursConfig"
 * collection. The stored windows meant the opposite thing under the previous
 * model, so silently inheriting them would invert every admin's intent — a
 * window that used to mean "busy, full price" would start meaning "quiet,
 * discount here". A fresh collection makes the admin re-enter (or auto-detect)
 * the quiet hours deliberately.
 */
const offPeakHoursConfigSchema = new Schema(
  {
    _id: { type: String, default: "global" },
    /**
     * IANA zone every window is interpreted in. Without this the meaning of
     * "08:00" would drift with whatever timezone the server happens to boot in.
     */
    timezone: { type: String, required: true, default: "Asia/Kolkata", trim: true },
    windows: { type: [offPeakWindowSchema], default: [] },
    /**
     * Master switch. Turning it off makes isOffPeakSlot() always false, which
     * deactivates every off-peak coupon at once without deleting the windows —
     * the admin equivalent of pausing rather than tearing down.
     */
    active: { type: Boolean, default: true },
    /**
     * Flat charge for moving a subsidised off-peak booking into a peak slot,
     * on top of reclaiming the discount itself.
     *
     * Lives here rather than with the dispatch reschedule settings because it is
     * the price of *leaving* off-peak — it only has meaning alongside the
     * windows above, and an admin setting one will want the other on the same
     * screen. Applies to every such upgrade regardless of how far ahead it is
     * made; there is deliberately no "last minute" window.
     */
    peakUpgradeFee: { type: Number, default: 100, min: 0 },
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

export type OffPeakWindow = InferSchemaType<typeof offPeakWindowSchema>;
export type OffPeakHoursConfigDoc = HydratedDocument<InferSchemaType<typeof offPeakHoursConfigSchema>>;
export const OffPeakHoursConfig = model("OffPeakHoursConfig", offPeakHoursConfigSchema);
