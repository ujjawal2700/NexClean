import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from "mongoose";
import { geoPointSchema } from "../../shared/geo";

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
    // Geo captured from Google Places when the address was picked. [lng, lat].
    coordinates: { type: [Number], default: undefined },
    placeId: { type: String, default: "" },
  },
  { _id: true, toJSON: subdocJson },
);

const userSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: "NexClean Member", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    role: { type: String, enum: ["customer", "agent", "admin"], default: "customer" },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    // Bumped to invalidate every JWT already issued for this account (log out
    // all devices). Embedded in the token as `ver` and compared on each
    // request — see shared/utils/jwt.ts.
    tokenVersion: { type: Number, default: 0 },
    password: { type: String, default: null },
    adminRoleId: { type: Schema.Types.ObjectId, ref: "AdminRole", default: null },
    subscriptionStartDate: { type: Date, default: null },
    subscriptionEndDate: { type: Date, default: null },
    vehicles: { type: [vehicleSchema], default: [] },
    addresses: { type: [addressSchema], default: [] },
    activePlan: { type: String, default: null },
    deviceTokens: { type: [String], default: [] },

    // Referrals + wallet (customers only)
    referralCode: { type: String, default: null },
    referredBy: { type: Types.ObjectId, ref: "User", default: null },
    // One-time guard: set true once the referrer has been rewarded for this user's first milestone.
    referralRewarded: { type: Boolean, default: false },
    // Signup fingerprint, used only to spot one person farming referral bonuses
    // across many phone numbers. Deliberately NOT used to block signups —
    // Indian mobile carriers NAT thousands of users behind one address, so
    // refusing an account on a shared IP would lock out real customers.
    signupIp: { type: String, default: "", index: true },
    signupDeviceId: { type: String, default: "", index: true },
    // Set when the welcome bonus was withheld as suspected farming.
    referralFlagged: { type: Boolean, default: false },
    // Coin wallet balance. Coins are earned via referrals and redeemable at checkout.
    coins: { type: Number, default: 0, min: 0 },

    // Agent profile (only meaningful when role === "agent")
    // City and area are picked from the admin-managed Locations list at signup,
    // stored as names rather than ids: everything downstream (area alerts,
    // the admin agent list) already matches on the society name, and a rename
    // in Locations shouldn't silently re-home existing cleaners. There is no
    // zoneId here on purpose — which geofence an agent is dispatched through
    // is computed live from `liveLocation` against the drawn zone polygons
    // (see dispatch/dispatch.query.ts), not a label set once at signup.
    city: { type: String, default: "" },
    area: { type: String, default: "" },
    rating: { type: Number, default: 0 },
    jobsDone: { type: Number, default: 0 },
    online: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: null },
    agentStatus: { type: String, enum: ["verified", "pending", "suspended", "unverified"], default: "verified" },

    // Agent live location (streamed while online) — used for nearest-agent dispatch. [lng, lat].
    liveLocation: { type: geoPointSchema(), default: undefined },
    locationUpdatedAt: { type: Date, default: null },
    // The booking this agent currently has an outstanding offer for (one at a time).
    currentOfferBooking: { type: Types.ObjectId, ref: "Booking", default: null },

    // Agent KYC (submitted at signup, reviewed by admin before activation)
    aadharNumber: { type: String, default: "" },
    aadharFrontUrl: { type: String, default: "" },
    aadharBackUrl: { type: String, default: "" },

    /**
     * Where an agent's payout requests get paid to. `branch` and `address` are
     * never typed in by the agent — they're resolved from `ifsc` against the
     * RBI IFSC master at save time, so what's on file always matches a real,
     * currently-valid branch rather than whatever the agent could type.
     */
    bankAccount: {
      type: new Schema(
        {
          holderName: { type: String, required: true, trim: true },
          bankName: { type: String, required: true, trim: true },
          accountNumber: { type: String, required: true },
          ifsc: { type: String, required: true, uppercase: true },
          branch: { type: String, required: true },
          address: { type: String, required: true },
          verifiedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: undefined,
    },
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
        // Never expose an agent's precise live GPS or internal dispatch state.
        delete ret.liveLocation;
        delete ret.locationUpdatedAt;
        delete ret.currentOfferBooking;
        // Never expose sensitive Aadhaar KYC document info in standard JSON serialization.
        delete ret.aadharNumber;
        delete ret.aadharFrontUrl;
        delete ret.aadharBackUrl;
        // Same reasoning as Aadhaar above — a bank account number has no
        // business riding along on every generic profile/session read. The
        // agent's own bank-account screen reads it via a dedicated endpoint
        // that selects the field explicitly.
        delete ret.bankAccount;
        return ret;
      },
    },
  },
);

// Geospatial index for nearest-agent queries ($geoNear / $near). 2dsphere
// indexes ignore documents missing the field, so customers/agents without a
// live location simply aren't matched.
userSchema.index({ liveLocation: "2dsphere" });

// Referral codes are unique only among users that actually have one. A plain
// `sparse` unique index is NOT enough here: sparse skips documents where the
// field is *missing*, but `default: null` writes an explicit null on every
// insert, so the second code-less user (any agent, any OTP-only signup)
// collided on `{ referralCode: null }` and the request 500'd. A partial index
// keyed on the string type ignores those nulls entirely.
userSchema.index(
  { referralCode: 1 },
  { unique: true, partialFilterExpression: { referralCode: { $type: "string" } }, name: "referralCode_unique" },
);

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model("User", userSchema);
