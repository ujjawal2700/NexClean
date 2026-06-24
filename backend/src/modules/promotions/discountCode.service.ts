import { DiscountCode, type DiscountCodeDoc } from "./discountCode.model";
import { ApiError } from "../../shared/utils/ApiError";

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
}) {
  const existing = await DiscountCode.findOne({ code: input.code.toUpperCase() });
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

/** Validate a code against an order amount and compute the discount (rupees). Does not mutate usage. */
export async function applyDiscountCode(rawCode: string, amount: number) {
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

  let discountAmount = code.type === "percent" ? (amount * code.value) / 100 : code.value;
  if (code.maxDiscount != null) discountAmount = Math.min(discountAmount, code.maxDiscount);
  discountAmount = Math.min(Math.round(discountAmount), amount);

  return { discountAmount, codeId: code.id as string, code: code.code };
}

/** Mark a code as used — call only once the booking it discounted is actually created. */
export async function incrementDiscountUsage(codeId: string) {
  await DiscountCode.findByIdAndUpdate(codeId, { $inc: { usageCount: 1 } });
}
