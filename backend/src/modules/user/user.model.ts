import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from "mongoose";

/** Map _id → id and drop internal fields when serializing subdocuments. */
const subdocJson = {
  virtuals: true,
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

const vehicleSchema = new Schema(
  {
    // Vehicle category key — admin-managed, not a fixed enum.
    type: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, default: "", trim: true },
    model: { type: String, default: "", trim: true },
    plate: { type: String, default: "—", trim: true },
  },
  { _id: true, toJSON: subdocJson },
);

const addressSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    line: { type: String, required: true, trim: true },
    society: { type: String, default: "", trim: true },
  },
  { _id: true, toJSON: subdocJson },
);

const userSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: "NexClean Member", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    role: { type: String, enum: ["customer", "agent", "admin"], default: "customer" },
    vehicles: { type: [vehicleSchema], default: [] },
    addresses: { type: [addressSchema], default: [] },
    activePlan: { type: String, default: null },
    deviceTokens: { type: [String], default: [] },

    // Referrals (customers only)
    referralCode: { type: String, default: null, unique: true, sparse: true, index: true },
    referredBy: { type: Types.ObjectId, ref: "User", default: null },
    referralEarnings: { type: Number, default: 0 },

    // Agent profile (only meaningful when role === "agent")
    area: { type: String, default: "" },
    rating: { type: Number, default: 4.8 },
    jobsDone: { type: Number, default: 0 },
    online: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: null },
    agentStatus: { type: String, enum: ["verified", "pending", "suspended"], default: "verified" },

    // Agent KYC (submitted at signup, reviewed by admin before activation)
    aadharNumber: { type: String, default: "" },
    aadharFrontUrl: { type: String, default: "" },
    aadharBackUrl: { type: String, default: "" },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.deviceTokens; // never expose push tokens to clients
        return ret;
      },
    },
  },
);

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model("User", userSchema);
