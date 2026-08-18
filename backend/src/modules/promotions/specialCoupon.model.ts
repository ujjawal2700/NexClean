import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from "mongoose";

const jsonTransform = {
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

/** Fixed prefix on every auto-generated special coupon code — makes checkout resolution
 *  between special coupons and normal discount codes unambiguous (single prefix check), and
 *  lets admins/support tell a gifted coupon apart from a typed promo code at a glance. */
export const SPECIAL_COUPON_PREFIX = "SPX-";

const usageHistorySchema = new Schema(
  {
    booking: { type: Types.ObjectId, ref: "Booking", required: true },
    usedBy: { type: Types.ObjectId, ref: "User", required: true },
    usedAt: { type: Date, required: true },
    discountAmount: { type: Number, required: true },
  },
  { _id: false },
);

const specialCouponSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    type: { type: String, enum: ["percent", "flat"], required: true },
    value: { type: Number, required: true, min: 0 },
    minOrderValue: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: null },
    validFrom: { type: Date, default: null },
    validTill: { type: Date, default: null },
    // "used" and "inactive" are kept distinct (not one boolean) so reactivating a used
    // coupon can be told apart from simply flipping a deactivated one back on.
    status: { type: String, enum: ["active", "used", "inactive"], default: "active", index: true },
    assignedCustomer: { type: Types.ObjectId, ref: "User", default: null, index: true },
    batchId: { type: String, required: true, index: true },
    /**
     * When true the coupon only applies to bookings whose *slot* falls inside a
     * configured off-peak window (see promotions/offPeakHours.service). Set per
     * batch at generation time.
     */
    offPeakOnly: { type: Boolean, default: false },
    usageHistory: { type: [usageHistorySchema], default: [] },
  },
  { timestamps: true, toJSON: jsonTransform },
);

export type SpecialCouponDoc = HydratedDocument<InferSchemaType<typeof specialCouponSchema>>;
export const SpecialCoupon = model("SpecialCoupon", specialCouponSchema);
