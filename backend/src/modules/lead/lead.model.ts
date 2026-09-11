import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { geoPointSchema } from "../../shared/geo";

const jsonTransform = {
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

/**
 * Lead — someone who wants service somewhere NexClean doesn't cover yet.
 * Saved after successful OTP verification so the phone is confirmed.
 * deviceToken is stored so we can send an FCM push when their area goes live.
 *
 * Two sources feed this, sharing one record shape and one admin queue:
 *  - the unserviced-city signup waitlist (city required, no coordinates —
 *    signup is a city/zone-name dropdown, there's no map pin at that step);
 *  - an existing customer's "request this area" tap when a pinned address
 *    falls outside every drawn geofence (point set, city usually blank —
 *    see lead.service.ts's requestArea). city is optional for this reason.
 */
const leadSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, unique: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    city: { type: String, default: "", trim: true },
    location: { type: String, default: "", trim: true },
    // The pinned point behind an area request, so admin can see exactly
    // where coverage was asked for rather than only a free-text description.
    point: { type: geoPointSchema(), default: undefined },
    deviceToken: { type: String, default: "" },
    /** Lead lifecycle status: new (awaiting launch), contacted, converted */
    status: { type: String, enum: ["new", "contacted", "converted"], default: "new" },
    /** Set to true once admin sends the "we're live in your city" notification. */
    notified: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: jsonTransform },
);

leadSchema.index({ point: "2dsphere" }, { sparse: true });


export type LeadDoc = HydratedDocument<InferSchemaType<typeof leadSchema>>;
export const Lead = model("Lead", leadSchema);
