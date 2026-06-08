import { Schema, model } from "mongoose";

const otpSchema = new Schema(
  {
    phone: { type: String, required: true, index: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// TTL index — MongoDB auto-removes expired OTP documents.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Otp = model("Otp", otpSchema);
