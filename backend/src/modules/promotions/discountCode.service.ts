import { DiscountCode, type DiscountCodeDoc } from "./discountCode.model";
import { SPECIAL_COUPON_PREFIX } from "./specialCoupon.model";
import { evaluateOffPeakSlot } from "./offPeakHours.service";
import { ApiError } from "../../shared/utils/ApiError";

/**
 * The slot a code is being spent on. Off-peak-only codes are checked against
 * this; codes without the flag ignore it entirely.
 */
export type RedemptionContext = { date: Date; slot: string };

/**
 * Shared gate for both code kinds. Kept here (rather than inlined twice) so the
 * off-peak rule can never drift between normal discount codes and special
 * coupons.
 *
 * Fails *closed* when an off-peak-only code is presented without slot context:
 * the alternative is granting the discount on a quote that booking creation
 * would then refuse, which shows the customer one price and charges another.
 */
export async function assertOffPeakEligible(
  offPeakOnly: boolean,
  context: RedemptionContext | undefined,
): Promise<void> {
  if (!offPeakOnly) return;
  if (!context) {
    throw ApiError.badRequest(
      "This coupon only works on off-peak slots — pick your date and time slot first",
    );
  }
  const { offPeak, reason } = await evaluateOffPeakSlot(context.date, context.slot);
  if (!offPeak) throw ApiError.badRequest(reason);
}

function mapCode(c: DiscountCodeDoc) {
  return {
    id: c.id,
    code: c.code,
    type: c.type,
    value: c.value,
    minOrderValue: c.minOrderValue,
    maxDiscount: c.maxDiscount,
    usageLimit: c.usageLimit,
    usageCount: c.usageCount,
    validTill: c.validTill,
    active: c.active,
    offPeakOnly: c.offPeakOnly,
    createdAt: c.get("createdAt") as Date,
  };
}

export async function listDiscountCodes() {
  const codes = await DiscountCode.find().sort({ createdAt: -1 });
  return codes.map(mapCode);
}

export async function createDiscountCode(input: {
  code: string;
  type: "percent" | "flat";
  value: number;
  minOrderValue?: number;
  maxDiscount?: number | null;
  usageLimit?: number | null;
  validTill?: Date | null;
  offPeakOnly?: boolean;
}) {
  const code = input.code.toUpperCase();
  if (code.startsWith(SPECIAL_COUPON_PREFIX)) {
    throw ApiError.badRequest(`Discount codes cannot start with the reserved "${SPECIAL_COUPON_PREFIX}" prefix`);
  }
  const existing = await DiscountCode.findOne({ code });
  if (existing) throw ApiError.badRequest("A discount code with that code already exists");
  return mapCode(await DiscountCode.create(input));
}

export async function updateDiscountCode(
  id: string,
  patch: {
    type?: "percent" | "flat";
    value?: number;
    minOrderValue?: number;
    maxDiscount?: number | null;
    usageLimit?: number | null;
    validTill?: Date | null;
    active?: boolean;
    offPeakOnly?: boolean;
  },
) {
  const code = await DiscountCode.findByIdAndUpdate(id, patch, { new: true });
  if (!code) throw ApiError.notFound("Discount code not found");
  return mapCode(code);
}

export async function deleteDiscountCode(id: string) {
  const code = await DiscountCode.findByIdAndDelete(id);
  if (!code) throw ApiError.notFound("Discount code not found");
}

/**
 * Validate a code against an order amount and compute the discount (rupees). Does not mutate usage.
 * `context` carries the booking's date + slot, required for off-peak-only codes.
 */
export async function applyDiscountCode(
  rawCode: string,
  amount: number,
  context?: RedemptionContext,
) {
  const code = await DiscountCode.findOne({ code: rawCode.trim().toUpperCase() });
  if (!code) throw ApiError.badRequest("Invalid discount code");
  if (!code.active) throw ApiError.badRequest("This discount code is no longer active");
  if (code.validTill && code.validTill.getTime() < Date.now()) {
    throw ApiError.badRequest("This discount code has expired");
  }
  if (code.usageLimit != null && code.usageCount >= code.usageLimit) {
    throw ApiError.badRequest("This discount code has reached its usage limit");
  }
  if (amount < code.minOrderValue) {
    throw ApiError.badRequest(`This code needs a minimum order of ₹${code.minOrderValue}`);
  }
  await assertOffPeakEligible(code.offPeakOnly, context);

  let discountAmount = code.type === "percent" ? (amount * code.value) / 100 : code.value;
  if (code.maxDiscount != null) discountAmount = Math.min(discountAmount, code.maxDiscount);
  discountAmount = Math.min(Math.round(discountAmount), amount);

  // `offPeakOnly` travels with the result so the booking can snapshot whether
  // this discount was conditional on the slot — that is the amount a later move
  // into a peak slot has to reclaim.
  return { discountAmount, codeId: code.id as string, code: code.code, offPeakOnly: code.offPeakOnly };
}

/** Mark a code as used — call only once the booking it discounted is actually created. */
export async function incrementDiscountUsage(codeId: string) {
  await DiscountCode.findByIdAndUpdate(codeId, { $inc: { usageCount: 1 } });
}
