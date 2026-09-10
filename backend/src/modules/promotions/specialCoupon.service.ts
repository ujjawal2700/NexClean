import crypto from "node:crypto";
import { SpecialCoupon, SPECIAL_COUPON_PREFIX, type SpecialCouponDoc } from "./specialCoupon.model";
import { DiscountCode } from "./discountCode.model";
import { assertOffPeakEligible, type RedemptionContext } from "./discountCode.service";
import { User } from "../user/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { notifyUser } from "../notification/notification.service";

// Ambiguous characters (0/O, 1/I) excluded so codes are easy to read back over a phone call.
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_SUFFIX_LENGTH = 6;

function mapCoupon(c: SpecialCouponDoc) {
  return {
    id: c.id,
    code: c.code,
    type: c.type,
    value: c.value,
    minOrderValue: c.minOrderValue,
    maxDiscount: c.maxDiscount,
    validFrom: c.validFrom,
    validTill: c.validTill,
    status: c.status,
    assignedCustomer: c.assignedCustomer,
    batchId: c.batchId,
    offPeakOnly: c.offPeakOnly,
    usageHistory: c.usageHistory,
    createdAt: (c as unknown as { createdAt: Date }).createdAt,
  };
}

export async function listSpecialCoupons() {
  const coupons = await SpecialCoupon.find()
    .populate("assignedCustomer", "name phone email")
    .sort({ createdAt: -1 });
  return coupons.map(mapCoupon);
}

function randomSuffix(): string {
  let s = "";
  for (let i = 0; i < CODE_SUFFIX_LENGTH; i++) {
    s += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return s;
}

/** Generate one code guaranteed unique against DiscountCode, SpecialCoupon, and any code
 *  already minted earlier in this same batch. */
async function generateUniqueCode(reserved: Set<string>): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `${SPECIAL_COUPON_PREFIX}${randomSuffix()}`;
    if (reserved.has(code)) continue;
    const [dupNormal, dupSpecial] = await Promise.all([
      DiscountCode.findOne({ code }),
      SpecialCoupon.findOne({ code }),
    ]);
    if (!dupNormal && !dupSpecial) {
      reserved.add(code);
      return code;
    }
  }
  throw new Error("Failed to generate a unique special coupon code");
}

export async function generateSpecialCoupons(input: {
  count: number;
  type: "percent" | "flat";
  value: number;
  minOrderValue?: number;
  maxDiscount?: number | null;
  validFrom?: Date | null;
  validTill?: Date | null;
  offPeakOnly?: boolean;
}) {
  if (input.count < 1 || input.count > 500) {
    throw ApiError.badRequest("Count must be between 1 and 500");
  }

  const batchId = crypto.randomUUID();
  const reserved = new Set<string>();
  const docs = [];
  for (let i = 0; i < input.count; i++) {
    const code = await generateUniqueCode(reserved);
    docs.push({
      code,
      type: input.type,
      value: input.value,
      minOrderValue: input.minOrderValue ?? 0,
      maxDiscount: input.maxDiscount ?? null,
      validFrom: input.validFrom ?? null,
      validTill: input.validTill ?? null,
      status: "active" as const,
      assignedCustomer: null,
      batchId,
      offPeakOnly: input.offPeakOnly ?? false,
      usageHistory: [],
    });
  }

  const created = await SpecialCoupon.insertMany(docs, { ordered: false });
  return created.map((c) => mapCoupon(c as SpecialCouponDoc));
}

export async function assignSpecialCoupon(couponId: string, customerId: string) {
  const coupon = await SpecialCoupon.findById(couponId);
  if (!coupon) throw ApiError.notFound("Coupon not found");
  if (coupon.assignedCustomer) throw ApiError.badRequest("This coupon is already assigned");
  if (coupon.status !== "active") throw ApiError.badRequest("Only an active coupon can be assigned");

  const customer = await User.findOne({ _id: customerId, role: "customer" });
  if (!customer) throw ApiError.notFound("Customer not found");

  coupon.assignedCustomer = customer.id;
  await coupon.save();

  const label =
    coupon.type === "percent" ? `${coupon.value}% off` : `₹${coupon.value} off`;
  void notifyUser(customer.id, {
    type: "coupon",
    title: "🎁 You've received a special coupon!",
    body: `You've been gifted a ${label} coupon. Use code ${coupon.code} at checkout.`,
    data: { couponId: coupon.id as string, code: coupon.code },
  }).catch((err) => console.error("special coupon notification failed:", (err as Error).message));

  return mapCoupon(await coupon.populate("assignedCustomer", "name phone email"));
}

export async function toggleSpecialCouponActive(couponId: string, active: boolean) {
  const coupon = await SpecialCoupon.findById(couponId);
  if (!coupon) throw ApiError.notFound("Coupon not found");
  if (coupon.status === "used") {
    throw ApiError.badRequest("This coupon has already been used — use reactivate instead");
  }
  coupon.status = active ? "active" : "inactive";
  await coupon.save();
  return mapCoupon(await coupon.populate("assignedCustomer", "name phone email"));
}

/** Restore a used coupon to active, keeping its assigned customer and usage history intact. */
export async function reactivateSpecialCoupon(couponId: string) {
  const coupon = await SpecialCoupon.findById(couponId);
  if (!coupon) throw ApiError.notFound("Coupon not found");
  if (coupon.status !== "used") throw ApiError.badRequest("Only a used coupon can be reactivated");
  coupon.status = "active";
  await coupon.save();
  return mapCoupon(await coupon.populate("assignedCustomer", "name phone email"));
}

/**
 * Validate a special coupon against an order amount and requesting customer. Does not mutate usage.
 * `context` carries the booking's date + slot, required for off-peak-only coupons.
 */
export async function applySpecialCoupon(
  rawCode: string,
  amount: number,
  userId: string,
  context?: RedemptionContext,
) {
  const coupon = await SpecialCoupon.findOne({ code: rawCode.trim().toUpperCase() });
  if (!coupon) throw ApiError.badRequest("Invalid coupon code");
  if (coupon.status === "inactive") throw ApiError.badRequest("This coupon is no longer active");
  if (coupon.status === "used") throw ApiError.badRequest("This coupon has already been used");
  if (!coupon.assignedCustomer) throw ApiError.badRequest("This coupon has not been assigned to a customer yet");
  if (String(coupon.assignedCustomer) !== String(userId)) {
    throw ApiError.badRequest("This coupon is assigned to a different account");
  }
  if (coupon.validFrom && coupon.validFrom.getTime() > Date.now()) {
    throw ApiError.badRequest("This coupon is not available yet");
  }
  if (coupon.validTill && coupon.validTill.getTime() < Date.now()) {
    throw ApiError.badRequest("This coupon has expired");
  }
  if (amount < coupon.minOrderValue) {
    throw ApiError.badRequest(`This coupon needs a minimum order of ₹${coupon.minOrderValue}`);
  }
  await assertOffPeakEligible(coupon.offPeakOnly, context);

  let discountAmount = coupon.type === "percent" ? (amount * coupon.value) / 100 : coupon.value;
  if (coupon.maxDiscount != null) discountAmount = Math.min(discountAmount, coupon.maxDiscount);
  discountAmount = Math.min(Math.round(discountAmount), amount);

  // See applyDiscountCode: the flag rides along so the booking can snapshot the
  // reclaimable portion of the discount.
  return {
    discountAmount,
    couponId: coupon.id as string,
    code: coupon.code,
    offPeakOnly: coupon.offPeakOnly,
  };
}

/** Mark a coupon as used — call only once the booking it discounted is actually created. */
export async function markSpecialCouponUsed(
  couponId: string,
  input: { bookingId: string; userId: string; discountAmount: number },
) {
  await SpecialCoupon.findByIdAndUpdate(couponId, {
    status: "used",
    $push: {
      usageHistory: {
        booking: input.bookingId,
        usedBy: input.userId,
        usedAt: new Date(),
        discountAmount: input.discountAmount,
      },
    },
  });
}
