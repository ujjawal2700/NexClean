import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const jsonTransform = {
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

/**
 * Lead — a user who signed up from a city where NexClean doesn't yet operate.
 * Saved after successful OTP verification so the phone is confirmed.
 * deviceToken is stored so we can send an FCM push when their city goes live.
 */
const leadSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, unique: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    city: { type: String, required: true, trim: true },
    location: { type: String, default: "", trim: true },
    deviceToken: { type: String, default: "" },
    /** Set to true once admin sends the "we're live in your city" notification. */
    notified: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: jsonTransform },
);

export type LeadDoc = HydratedDocument<InferSchemaType<typeof leadSchema>>;
export const Lead = model("Lead", leadSchema);
