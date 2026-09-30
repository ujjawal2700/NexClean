import type { Request, Response } from "express";
import { z } from "zod";
import { ok, created } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import { getPricing, updatePricing } from "../pricing/pricing.service";
import * as locationService from "../location/location.service";
import * as brandService from "../brand/brand.service";
import * as vehicleModelService from "../brand/vehicleModel.service";
import * as categoryService from "../catalog/category.service";
import * as discountCodeService from "../promotions/discountCode.service";
import * as specialCouponService from "../promotions/specialCoupon.service";
import { getReferralConfig, updateReferralConfig } from "../promotions/referralConfig.service";
import { getOffPeakHoursConfig, updateOffPeakHoursConfig } from "../promotions/offPeakHours.service";
import { suggestOffPeakWindows } from "../promotions/offPeakSuggest.service";
import { getPayoutConfig, updatePayoutConfig } from "../payout/payoutConfig.service";
import * as payoutRequestService from "../payout/payoutRequest.service";
import * as promoBannerService from "../promotions/promoBanner.service";
import { BANNER_TYPES } from "../promotions/promoBanner.model";
import * as service from "./admin.service";
import { getContent, updateContent } from "../content/content.service";
import { AdminRole } from "./adminRole.model";
import { User } from "../user/user.model";
import { env } from "../../config/env";
import { hashPassword } from "../../shared/utils/crypto";
import { TIME_SLOTS, SLOT_LIST } from "../../shared/slots";

/** A positive price per vehicle category key — keys are admin-managed, not a fixed set. */
const pricesSchema = z.record(z.string(), z.number().positive());

export async function stats(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.stats());
}

export async function reports(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.reports());
}

export async function bookings(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listBookings());
}

export async function bookingDetail(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.getBookingDetail(String(req.params.id)));
}

export async function cancelBooking(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.cancelBooking(String(req.params.id)), "Booking cancelled");
}

const bookingStatusSchema = z.object({
  status: z.enum(["upcoming", "in_progress", "completed", "cancelled"]),
});
export async function setBookingStatus(req: Request, res: Response): Promise<Response> {
  const parsed = bookingStatusSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid status");
  return ok(res, await service.setBookingStatus(String(req.params.id), parsed.data.status), "Booking status updated");
}

const assignSchema = z.object({ agentId: z.string().min(1) });
export async function assignBooking(req: Request, res: Response): Promise<Response> {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Agent is required");
  return ok(res, await service.assignAgent(String(req.params.id), parsed.data.agentId), "Agent assigned");
}

export async function autoAssignBooking(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.autoAssignBooking(String(req.params.id)), "Agent auto-assigned");
}

const rescheduleSchema = z.object({
  date: z.string().min(1),
  slot: z.enum(TIME_SLOTS),
  /** Let a peak upgrade through without charging — a recorded goodwill decision. */
  waiveUpgrade: z.boolean().optional(),
});
export async function rescheduleBooking(req: Request, res: Response): Promise<Response> {
  const parsed = rescheduleSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest(`Date and a valid slot are required (one of: ${SLOT_LIST})`);
  return ok(
    res,
    await service.rescheduleBooking(String(req.params.id), parsed.data, req.userId),
    "Booking rescheduled successfully",
  );
}

/**
 * What moving this booking to a given slot would cost, without moving it.
 *
 * Read-only, so an admin can see the consequence before committing — and so the
 * rule engine has one place to be exercised directly rather than only through
 * whichever endpoint happens to call it.
 */
export async function rescheduleQuote(req: Request, res: Response): Promise<Response> {
  const parsed = rescheduleSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest(`Date and a valid slot are required (one of: ${SLOT_LIST})`);
  return ok(res, await service.quoteReschedule(String(req.params.id), parsed.data));
}

import { getRescheduleConfig, updateRescheduleConfig } from "../dispatch/slotScheduler.service";

export async function getRescheduleConfigCtl(_req: Request, res: Response): Promise<Response> {
  return ok(res, await getRescheduleConfig());
}

const rescheduleConfigSchema = z.object({
  bufferMinutes: z.number().int().min(0).optional(),
  maxDaysLimit: z.number().int().min(1).optional(),
});
export async function updateRescheduleConfigCtl(req: Request, res: Response): Promise<Response> {
  const parsed = rescheduleConfigSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid reschedule config");
  return ok(res, await updateRescheduleConfig(parsed.data), "Reschedule config updated");
}

export async function dispatchQueue(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.dispatchQueue());
}

/** Bulk: re-dispatch every unassigned booking in one click. */
export async function autoAssignAll(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.autoAssignAll(), "Bulk auto-assign triggered");
}

export async function assignableAgents(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.assignableAgents(String(req.params.id)));
}

export async function agents(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listAgents());
}

/* ----------------------- Agent & customer CRUD ---------------------------- */

// Same rules the customer-facing profile uses, so an admin can't create an
// account the owner would then be unable to edit.
const personName = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(60)
  .regex(/^[\p{L}\p{M}\s.'-]+$/u, "Name must contain letters only, no numbers or special symbols");
const personPhone = z.string().trim().regex(/^\d{10}$/, "Mobile number must be exactly 10 digits");
const personEmail = z.string().trim().email("Enter a valid email address").max(120).optional().or(z.literal(""));

const AGENT_STATUSES = ["verified", "pending", "suspended", "unverified"] as const;
/** Optional because plenty of admin-added cleaners are onboarded before KYC. */
const aadharNumber = z
  .string()
  .trim()
  .regex(/^\d{12}$/, "Aadhaar number must be exactly 12 digits")
  .optional()
  .or(z.literal(""));

const agentFields = {
  email: personEmail,
  city: z.string().trim().max(80).optional(),
  area: z.string().trim().max(120).optional(),
  agentStatus: z.enum(AGENT_STATUSES).optional(),
  aadharNumber,
  rating: z.coerce.number().min(0).max(5).optional(),
};
const createAgentSchema = z.object({ name: personName, phone: personPhone, ...agentFields });
const updateAgentSchema = z.object({
  name: personName.optional(),
  phone: personPhone.optional(),
  ...agentFields,
});

export async function createAgent(req: Request, res: Response): Promise<Response> {
  const parsed = createAgentSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest(parsed.error.errors[0]?.message ?? "Invalid agent details");
  return created(res, await service.createAgent(parsed.data), "Agent created");
}

export async function updateAgent(req: Request, res: Response): Promise<Response> {
  const parsed = updateAgentSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest(parsed.error.errors[0]?.message ?? "Invalid agent details");
  return ok(res, await service.updateAgent(String(req.params.id), parsed.data), "Agent updated");
}

export async function deleteAgent(req: Request, res: Response): Promise<Response> {
  const queryMode = req.query.mode as service.DeleteAgentMode | undefined;
  const bodyMode = req.body?.mode as service.DeleteAgentMode | undefined;
  const isForce = req.query.force === "true" || req.body?.force === true;

  let mode: service.DeleteAgentMode = "strict";
  if (queryMode === "agent_only" || queryMode === "with_data" || queryMode === "strict") {
    mode = queryMode;
  } else if (bodyMode === "agent_only" || bodyMode === "with_data" || bodyMode === "strict") {
    mode = bodyMode;
  } else if (isForce) {
    mode = "agent_only";
  }

  return ok(res, await service.deleteAgent(String(req.params.id), mode), "Agent deleted");
}

/**
 * A customer's first address and vehicle, so an admin taking a booking over the
 * phone can capture everything in one go. Both are optional and both are
 * all-or-nothing: an address without a line, or a vehicle without a name, is
 * not worth storing.
 */
const addressInput = z
  .object({
    label: z.string().trim().max(40).optional(),
    line: z.string().trim().max(200).optional(),
    society: z.string().trim().max(120).optional(),
  })
  .optional();
const vehicleInput = z
  .object({
    type: z.string().trim().max(60).optional(),
    name: z.string().trim().max(60).optional(),
    plate: z.string().trim().max(20).optional(),
  })
  .optional();

const customerFields = {
  email: personEmail,
  status: z.enum(["active", "suspended"]).optional(),
  address: addressInput,
  vehicle: vehicleInput,
};
const createCustomerSchema = z.object({ name: personName, phone: personPhone, ...customerFields });
const updateCustomerSchema = z.object({
  name: personName.optional(),
  phone: personPhone.optional(),
  ...customerFields,
});

export async function createCustomer(req: Request, res: Response): Promise<Response> {
  const parsed = createCustomerSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest(parsed.error.errors[0]?.message ?? "Invalid customer details");
  return created(res, await service.createCustomer(parsed.data), "Customer created");
}

export async function updateCustomer(req: Request, res: Response): Promise<Response> {
  const parsed = updateCustomerSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest(parsed.error.errors[0]?.message ?? "Invalid customer details");
  return ok(res, await service.updateCustomer(String(req.params.id), parsed.data), "Customer updated");
}

export async function deleteCustomer(req: Request, res: Response): Promise<Response> {
  const queryMode = req.query.mode as service.DeleteCustomerMode | undefined;
  const bodyMode = req.body?.mode as service.DeleteCustomerMode | undefined;
  const isForce = req.query.force === "true" || req.body?.force === true;

  let mode: service.DeleteCustomerMode = "strict";
  if (queryMode === "customer_only" || queryMode === "with_data" || queryMode === "strict") {
    mode = queryMode;
  } else if (bodyMode === "customer_only" || bodyMode === "with_data" || bodyMode === "strict") {
    mode = bodyMode;
  } else if (isForce) {
    mode = "customer_only";
  }

  return ok(res, await service.deleteCustomer(String(req.params.id), mode), "Customer deleted");
}

const agentStatusSchema = z.object({ status: z.enum(["verified", "pending", "suspended"]) });
export async function setAgentStatus(req: Request, res: Response): Promise<Response> {
  const parsed = agentStatusSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid status");
  return ok(res, await service.setAgentStatus(String(req.params.id), parsed.data.status), "Agent updated");
}

export async function agentDetail(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.getAgent(String(req.params.id)));
}

export async function agentActivity(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.getAgentActivity(String(req.params.id)));
}

export async function pricing(_req: Request, res: Response): Promise<Response> {
  return ok(res, await getPricing());
}

const pricingSchema = z.object({
  base: z.record(z.string(), z.number()).optional(),
  packages: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        factor: z.number(),
        durationMinutes: z.number().nullable().optional(),
        active: z.boolean().optional(),
      }),
    )
    .optional(),
});
export async function updatePricingCtl(req: Request, res: Response): Promise<Response> {
  const parsed = pricingSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid pricing");
  return ok(res, await updatePricing(parsed.data), "Pricing updated");
}

export async function plans(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listPlans());
}

const createPlanSchema = z.object({
  name: z.string().min(1),
  prices: pricesSchema,
  washesPerMonth: z.number().int(),
});
export async function createPlan(req: Request, res: Response): Promise<Response> {
  const parsed = createPlanSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Name, per-vehicle prices and washes per month are required");
  return created(res, await service.createPlan(parsed.data), "Plan created");
}

const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  prices: pricesSchema.optional(),
  washesPerMonth: z.number().int().optional(),
  active: z.boolean().optional(),
});
export async function updatePlan(req: Request, res: Response): Promise<Response> {
  const parsed = updatePlanSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid plan update");
  return ok(res, await service.updatePlan(String(req.params.id), parsed.data), "Plan updated");
}

export async function deletePlan(req: Request, res: Response): Promise<Response> {
  await service.deletePlan(String(req.params.id));
  return ok(res, null, "Plan deleted");
}

const agentAreaSchema = z.object({ area: z.string().trim().min(1) });
export async function updateAgentArea(req: Request, res: Response): Promise<Response> {
  const parsed = agentAreaSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Area is required");
  return ok(res, await service.updateAgentArea(String(req.params.id), parsed.data.area), "Agent area updated");
}

export async function cities(_req: Request, res: Response): Promise<Response> {
  return ok(res, await locationService.listCities());
}

const createCitySchema = z.object({ name: z.string().trim().min(1) });
export async function createCity(req: Request, res: Response): Promise<Response> {
  const parsed = createCitySchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("City name is required");
  return created(res, await locationService.createCity(parsed.data), "City created");
}

const updateCitySchema = z.object({ name: z.string().trim().min(1).optional(), active: z.boolean().optional() });
export async function updateCity(req: Request, res: Response): Promise<Response> {
  const parsed = updateCitySchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid city update");
  return ok(res, await locationService.updateCity(String(req.params.id), parsed.data), "City updated");
}

export async function deleteCity(req: Request, res: Response): Promise<Response> {
  await locationService.deleteCity(String(req.params.id));
  return ok(res, null, "City deleted");
}

export async function zones(_req: Request, res: Response): Promise<Response> {
  return ok(res, await locationService.listZones());
}

// cityId is optional on purpose: a zone is a standalone geofence, not a
// City's child. It's only kept to link a zone into the customer/agent signup
// "pick your society" pickers (catalog.controller's /zones?cityId=) when an
// admin chooses to. coordinates (the boundary) is what's actually required —
// a zone that isn't a real polygon can't be dispatched through.
const createZoneSchema = z.object({
  name: z.string().trim().min(1),
  cityId: z.string().min(1).optional(),
  color: z.string().trim().optional(),
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(3),
  active: z.boolean().optional(),
});
export async function createZone(req: Request, res: Response): Promise<Response> {
  const parsed = createZoneSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Zone name and a boundary are required");
  return created(res, await locationService.createZone(parsed.data), "Zone created");
}

const updateZoneSchema = z.object({
  name: z.string().trim().min(1).optional(),
  active: z.boolean().optional(),
  cityId: z.string().min(1).nullable().optional(),
  color: z.string().trim().optional(),
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(3).optional(),
});
export async function updateZone(req: Request, res: Response): Promise<Response> {
  const parsed = updateZoneSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid zone update");
  return ok(res, await locationService.updateZone(String(req.params.id), parsed.data), "Zone updated");
}

export async function deleteZone(req: Request, res: Response): Promise<Response> {
  await locationService.deleteZone(String(req.params.id));
  return ok(res, null, "Zone deleted");
}

export async function zoneAgents(req: Request, res: Response): Promise<Response> {
  return ok(res, await locationService.listAgentsInZone(String(req.params.id)));
}

/* --------------------------- Vehicle categories -------------------------- */

export async function vehicleCategories(_req: Request, res: Response): Promise<Response> {
  return ok(res, await categoryService.listCategories());
}

const createCategorySchema = z.object({
  name: z.string().trim().min(1),
  basePrice: z.number().positive(),
  imageUrl: z.string().optional(),
});
export async function createVehicleCategory(req: Request, res: Response): Promise<Response> {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Category name and base price are required");
  return created(res, await categoryService.createCategory(parsed.data), "Category created");
}

const updateCategorySchema = z.object({
  name: z.string().trim().min(1).optional(),
  basePrice: z.number().positive().optional(),
  imageUrl: z.string().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export async function updateVehicleCategory(req: Request, res: Response): Promise<Response> {
  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid category update");
  return ok(res, await categoryService.updateCategory(String(req.params.id), parsed.data), "Category updated");
}

export async function deleteVehicleCategory(req: Request, res: Response): Promise<Response> {
  await categoryService.deleteCategory(String(req.params.id));
  return ok(res, null, "Category deleted");
}

/* ------------------------------ Vehicle brands ---------------------------- */

export async function vehicleBrands(_req: Request, res: Response): Promise<Response> {
  return ok(res, await brandService.listBrands());
}

const createBrandSchema = z.object({ name: z.string().trim().min(1) });
export async function createVehicleBrand(req: Request, res: Response): Promise<Response> {
  const parsed = createBrandSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Brand name is required");
  return created(res, await brandService.createBrand(parsed.data), "Brand created");
}

const updateBrandSchema = z.object({ name: z.string().trim().min(1).optional(), active: z.boolean().optional() });
export async function updateVehicleBrand(req: Request, res: Response): Promise<Response> {
  const parsed = updateBrandSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid brand update");
  return ok(res, await brandService.updateBrand(String(req.params.id), parsed.data), "Brand updated");
}

export async function deleteVehicleBrand(req: Request, res: Response): Promise<Response> {
  await brandService.deleteBrand(String(req.params.id));
  return ok(res, null, "Brand deleted");
}

/* ------------------------------ Vehicle models ---------------------------- */

export async function vehicleModels(req: Request, res: Response): Promise<Response> {
  return ok(res, await vehicleModelService.listModelsForBrand(String(req.params.id)));
}

const createModelSchema = z.object({ name: z.string().trim().min(1), categoryKey: z.string().min(1) });
export async function createVehicleModel(req: Request, res: Response): Promise<Response> {
  const parsed = createModelSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Model name and category are required");
  return created(
    res,
    await vehicleModelService.createModel(String(req.params.id), parsed.data),
    "Model added",
  );
}

const updateModelSchema = z.object({
  name: z.string().trim().min(1).optional(),
  categoryKey: z.string().min(1).optional(),
  active: z.boolean().optional(),
});
export async function updateVehicleModel(req: Request, res: Response): Promise<Response> {
  const parsed = updateModelSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid model update");
  return ok(res, await vehicleModelService.updateModel(String(req.params.modelId), parsed.data), "Model updated");
}

export async function deleteVehicleModel(req: Request, res: Response): Promise<Response> {
  await vehicleModelService.deleteModel(String(req.params.modelId));
  return ok(res, null, "Model removed");
}

export async function discountCodes(_req: Request, res: Response): Promise<Response> {
  return ok(res, await discountCodeService.listDiscountCodes());
}

const createDiscountCodeSchema = z.object({
  code: z.string().trim().min(1),
  type: z.enum(["percent", "flat"]),
  value: z.number().positive(),
  minOrderValue: z.number().min(0).optional(),
  maxDiscount: z.number().min(0).nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  validTill: z.coerce.date().nullable().optional(),
  offPeakOnly: z.boolean().optional(),
});
export async function createDiscountCode(req: Request, res: Response): Promise<Response> {
  const parsed = createDiscountCodeSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid discount code");
  return created(res, await discountCodeService.createDiscountCode(parsed.data), "Discount code created");
}

const updateDiscountCodeSchema = z.object({
  type: z.enum(["percent", "flat"]).optional(),
  value: z.number().positive().optional(),
  minOrderValue: z.number().min(0).optional(),
  maxDiscount: z.number().min(0).nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  validTill: z.coerce.date().nullable().optional(),
  active: z.boolean().optional(),
  offPeakOnly: z.boolean().optional(),
});
export async function updateDiscountCode(req: Request, res: Response): Promise<Response> {
  const parsed = updateDiscountCodeSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid discount code update");
  return ok(res, await discountCodeService.updateDiscountCode(String(req.params.id), parsed.data), "Discount code updated");
}

export async function deleteDiscountCode(req: Request, res: Response): Promise<Response> {
  await discountCodeService.deleteDiscountCode(String(req.params.id));
  return ok(res, null, "Discount code deleted");
}

export async function specialCoupons(_req: Request, res: Response): Promise<Response> {
  return ok(res, await specialCouponService.listSpecialCoupons());
}

const generateSpecialCouponsSchema = z.object({
  count: z.number().int().min(1).max(500),
  type: z.enum(["percent", "flat"]),
  value: z.number().positive(),
  minOrderValue: z.number().min(0).optional(),
  maxDiscount: z.number().min(0).nullable().optional(),
  validFrom: z.coerce.date().nullable().optional(),
  validTill: z.coerce.date().nullable().optional(),
  offPeakOnly: z.boolean().optional(),
});
export async function generateSpecialCoupons(req: Request, res: Response): Promise<Response> {
  const parsed = generateSpecialCouponsSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid coupon batch request");
  return created(res, await specialCouponService.generateSpecialCoupons(parsed.data), "Special coupons generated");
}

const assignSpecialCouponSchema = z.object({ customerId: z.string().min(1) });
export async function assignSpecialCoupon(req: Request, res: Response): Promise<Response> {
  const parsed = assignSpecialCouponSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("A customer is required");
  return ok(
    res,
    await specialCouponService.assignSpecialCoupon(String(req.params.id), parsed.data.customerId),
    "Coupon assigned",
  );
}

const toggleSpecialCouponSchema = z.object({ active: z.boolean() });
export async function toggleSpecialCouponActive(req: Request, res: Response): Promise<Response> {
  const parsed = toggleSpecialCouponSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid status");
  return ok(
    res,
    await specialCouponService.toggleSpecialCouponActive(String(req.params.id), parsed.data.active),
    "Coupon updated",
  );
}

export async function reactivateSpecialCoupon(req: Request, res: Response): Promise<Response> {
  return ok(res, await specialCouponService.reactivateSpecialCoupon(String(req.params.id)), "Coupon reactivated");
}

export async function referralConfig(_req: Request, res: Response): Promise<Response> {
  return ok(res, await getReferralConfig());
}

const updateReferralConfigSchema = z.object({
  referrerReward: z.number().min(0).optional(),
  refereeReward: z.number().min(0).optional(),
  coinsPerRupee: z.number().min(1).optional(),
  maxRedeemPercent: z.number().min(0).max(100).optional(),
  active: z.boolean().optional(),
});
export async function updateReferralConfigHandler(req: Request, res: Response): Promise<Response> {
  const parsed = updateReferralConfigSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid referral config update");
  return ok(res, await updateReferralConfig(parsed.data), "Referral settings updated");
}

/* ------------------------------ Off-peak hours --------------------------- */

export async function offPeakHours(_req: Request, res: Response): Promise<Response> {
  return ok(res, await getOffPeakHoursConfig());
}

const suggestQuerySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(104).optional(),
  sensitivity: z.coerce.number().min(0.1).max(3).optional(),
  minSamples: z.coerce.number().int().min(0).optional(),
});
/**
 * Propose off-peak windows from booking history. Read-only by design — it hands
 * back a draft plus the numbers behind it, and the admin saves through the
 * normal PUT if they agree.
 */
export async function suggestOffPeakHours(req: Request, res: Response): Promise<Response> {
  const parsed = suggestQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw ApiError.badRequest(issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid suggestion options");
  }
  return ok(
    res,
    await suggestOffPeakWindows({
      lookbackWeeks: parsed.data.weeks,
      sensitivity: parsed.data.sensitivity,
      minSamplesPerDay: parsed.data.minSamples,
    }),
  );
}

const offPeakWindowSchema = z.object({
  day: z.number().int().min(0).max(6),
  start: z.string().trim().min(1),
  end: z.string().trim().min(1),
  label: z.string().trim().max(60).optional(),
});
const updateOffPeakHoursSchema = z.object({
  timezone: z.string().trim().min(1).optional(),
  // Capped so one request can't store an unbounded document; 7 days × a
  // generous number of windows each is far beyond any real configuration.
  windows: z.array(offPeakWindowSchema).max(70).optional(),
  peakUpgradeFee: z.number().min(0).optional(),
  active: z.boolean().optional(),
});
export async function updateOffPeakHoursHandler(req: Request, res: Response): Promise<Response> {
  const parsed = updateOffPeakHoursSchema.safeParse(req.body);
  // Unlike the sibling handlers, the specific message from the service layer is
  // worth surfacing here — "end must be after start" tells an admin what to fix,
  // where a flat "invalid update" would leave them guessing which row is wrong.
  // The field path is prefixed because zod's bare "Required" says nothing about
  // *which* of several windows is missing a field.
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    throw ApiError.badRequest(issue ? `${where}${issue.message}` : "Invalid off-peak hours update");
  }
  return ok(res, await updateOffPeakHoursConfig(parsed.data), "Off-peak hours updated");
}

/* ---------------------------- Agent payouts ------------------------------ */

export async function payoutConfig(_req: Request, res: Response): Promise<Response> {
  return ok(res, await getPayoutConfig());
}

const updatePayoutConfigSchema = z
  .object({
    mode: z.enum(["percent", "flat"]).optional(),
    percent: z.number().min(0).max(100).optional(),
    flatAmount: z.number().min(0).optional(),
    minPayout: z.number().min(0).optional(),
    maxPayout: z.number().min(0).optional(),
  })
  .refine((v) => v.maxPayout === undefined || v.minPayout === undefined || v.maxPayout === 0 || v.maxPayout >= v.minPayout, {
    message: "Maximum payout cannot be below the minimum payout",
  });
export async function updatePayoutConfigHandler(req: Request, res: Response): Promise<Response> {
  const parsed = updatePayoutConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid payout settings");
  }
  // A saved rule must be usable on its own: switching to "flat" without an
  // amount, or to "percent" with 0%, would quietly zero out every cleaner's
  // earnings on the next job.
  const current = await getPayoutConfig();
  const next = { ...current, ...parsed.data };
  if (next.mode === "flat" && next.flatAmount <= 0) {
    throw ApiError.badRequest("Set a flat amount above ₹0 before switching to flat payouts");
  }
  if (next.mode === "percent" && next.percent <= 0) {
    throw ApiError.badRequest("Set a percentage above 0% before saving");
  }
  if (next.maxPayout > 0 && next.maxPayout < next.minPayout) {
    throw ApiError.badRequest("Maximum payout cannot be below the minimum payout");
  }
  return ok(res, await updatePayoutConfig(parsed.data), "Agent payout settings updated");
}

export async function promoBanners(_req: Request, res: Response): Promise<Response> {
  return ok(res, await promoBannerService.listPromoBanners());
}

const createPromoBannerSchema = z.object({
  title: z.string().trim().min(1),
  subtitle: z.string().trim().optional(),
  imageUrl: z.string().trim().min(1),
  ctaLabel: z.string().trim().optional(),
  ctaLink: z.string().trim().optional(),
  type: z.enum(BANNER_TYPES).optional(),
  sortOrder: z.number().optional(),
});
export async function createPromoBanner(req: Request, res: Response): Promise<Response> {
  const parsed = createPromoBannerSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid promotional banner");
  return created(res, await promoBannerService.createPromoBanner(parsed.data), "Promotional banner created");
}

const updatePromoBannerSchema = z.object({
  title: z.string().trim().min(1).optional(),
  subtitle: z.string().trim().optional(),
  imageUrl: z.string().trim().min(1).optional(),
  ctaLabel: z.string().trim().optional(),
  ctaLink: z.string().trim().optional(),
  type: z.enum(BANNER_TYPES).optional(),
  sortOrder: z.number().optional(),
  active: z.boolean().optional(),
});
export async function updatePromoBanner(req: Request, res: Response): Promise<Response> {
  const parsed = updatePromoBannerSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid promotional banner update");
  return ok(res, await promoBannerService.updatePromoBanner(String(req.params.id), parsed.data), "Promotional banner updated");
}

export async function deletePromoBanner(req: Request, res: Response): Promise<Response> {
  await promoBannerService.deletePromoBanner(String(req.params.id));
  return ok(res, null, "Promotional banner deleted");
}

export async function campaigns(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listCampaigns());
}

export async function campaignAudienceSizes(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.audienceSizes());
}

/** The audience picker's options, grouped by app, so the UI isn't a hardcoded copy. */
export async function campaignAudiences(_req: Request, res: Response): Promise<Response> {
  return ok(res, service.AUDIENCE_GROUPS);
}

const campaignSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  audience: z.string().min(1),
});
export async function sendCampaign(req: Request, res: Response): Promise<Response> {
  const parsed = campaignSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Title, body and audience are required");
  const campaign = await service.sendCampaign(parsed.data);
  return created(res, campaign, `Sent to ${campaign.sentCount} recipient(s)`);
}

export async function customers(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listCustomers());
}

export async function customerDetail(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.getCustomer(String(req.params.id)));
}

const customerStatusSchema = z.object({ status: z.enum(["active", "suspended"]) });
export async function setCustomerStatus(req: Request, res: Response): Promise<Response> {
  const parsed = customerStatusSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid status");
  return ok(res, await service.setCustomerStatus(String(req.params.id), parsed.data.status), "Customer updated");
}

export async function customerActivity(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.getCustomerActivity(String(req.params.id)));
}

export async function payments(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listPayments());
}

export async function paymentStats(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.paymentStats());
}

const refundSchema = z.object({ amount: z.number().positive().optional(), reason: z.string().optional() });
export async function refundPayment(req: Request, res: Response): Promise<Response> {
  const parsed = refundSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid refund request");
  return ok(res, await service.refundPayment(String(req.params.id), parsed.data), "Payment refunded");
}

export async function settlePayment(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.settlePayment(String(req.params.id)), "Payment settled");
}

// ── Agent payout requests ───────────────────────────────────────────────────

export async function payoutRequests(req: Request, res: Response): Promise<Response> {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  return ok(res, await payoutRequestService.listAllPayoutRequests(status));
}

export async function approvePayoutRequest(req: Request, res: Response): Promise<Response> {
  return ok(
    res,
    await payoutRequestService.approvePayoutRequest(String(req.params.id), req.userId!),
    "Payout request approved",
  );
}

const rejectPayoutSchema = z.object({ reason: z.string().optional() });
export async function rejectPayoutRequest(req: Request, res: Response): Promise<Response> {
  const parsed = rejectPayoutSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid request");
  return ok(
    res,
    await payoutRequestService.rejectPayoutRequest(String(req.params.id), req.userId!, parsed.data.reason ?? ""),
    "Payout request declined",
  );
}

const markPaidSchema = z.object({ transactionRef: z.string().optional() });
export async function markPayoutRequestPaid(req: Request, res: Response): Promise<Response> {
  const parsed = markPaidSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid request");
  return ok(
    res,
    await payoutRequestService.markPayoutRequestPaid(String(req.params.id), req.userId!, parsed.data.transactionRef),
    "Payout marked as paid",
  );
}

// ── Site content (footer + landing pages) ──────────────────────────────────
const linkSchema = z.object({ label: z.string(), href: z.string() });
const footerSchema = z.object({
  tagline: z.string(),
  columns: z.array(z.object({ title: z.string(), links: z.array(linkSchema) })),
  bottomLeft: z.string(),
  bottomRight: z.string(),
});
const prosePageSchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
  subtitle: z.string(),
  body: z.string(),
});
const pagesSchema = z.object({
  about: prosePageSchema,
  careers: prosePageSchema,
  privacy: prosePageSchema,
  terms: prosePageSchema,
  refund: prosePageSchema,
});
const contactSchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
  subtitle: z.string(),
  body: z.string(),
  channels: z.array(
    z.object({ type: z.enum(["email", "phone", "address"]), label: z.string(), value: z.string(), href: z.string() }),
  ),
});
const helpSchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
  subtitle: z.string(),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })),
});
const headingSchema = z.object({ eyebrow: z.string(), title: z.string(), subtitle: z.string() });
const landingSchema = z.object({
  hero: z.object({
    badge: z.string(),
    title: z.string(),
    subtitle: z.string(),
    primaryCta: z.string(),
    secondaryCta: z.string(),
    trust: z.array(z.string()),
  }),
  emotionalStory: z.object({
    badge: z.string(),
    title: z.string(),
    body: z.string(),
    caption: z.string(),
    moments: z.array(z.string()),
  }),
  problemSolution: headingSchema.extend({
    oldWayLabel: z.string(),
    newWayLabel: z.string(),
    problems: z.array(z.string()),
    solutions: z.array(z.string()),
  }),
  howItWorks: headingSchema.extend({
    steps: z.array(z.object({ title: z.string(), body: z.string() })),
  }),
  vehicleCategories: headingSchema,
  smartAreaAlert: z.object({
    badge: z.string(),
    title: z.string(),
    body: z.string(),
    features: z.array(z.string()),
  }),
  whyChoose: headingSchema.extend({
    reasons: z.array(z.object({ title: z.string(), body: z.string() })),
  }),
  subscriptions: headingSchema.extend({ footnote: z.string() }),
  appShowcase: z.object({
    badge: z.string(),
    title: z.string(),
    body: z.string(),
    features: z.array(z.string()),
  }),
  testimonials: headingSchema.extend({
    reviews: z.array(
      z.object({ name: z.string(), role: z.string(), initials: z.string(), quote: z.string() }),
    ),
  }),
  stats: z.object({
    items: z.array(
      z.object({
        value: z.number(),
        decimals: z.number().optional(),
        suffix: z.string(),
        label: z.string(),
      }),
    ),
  }),
  finalCta: z.object({
    title: z.string(),
    body: z.string(),
    primaryCta: z.string(),
    secondaryCta: z.string(),
  }),
});

const contentSchema = z
  .object({
    footer: footerSchema,
    pages: pagesSchema,
    contact: contactSchema,
    help: helpSchema,
    landing: landingSchema,
  })
  .partial();

export async function content(_req: Request, res: Response): Promise<Response> {
  return ok(res, await getContent());
}

export async function updateContentCtl(req: Request, res: Response): Promise<Response> {
  const parsed = contentSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid content");
  return ok(res, await updateContent(parsed.data), "Content updated");
}

export async function listReferralLogs(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listReferralLogs());
}

import { uploadImage } from "../../shared/utils/cloudinary";

/** Image types we're willing to accept and hand to Cloudinary. */
const ALLOWED_IMAGE_TYPES = ["png", "jpeg", "jpg", "webp", "gif", "avif"];
/** Decoded ceiling, well under the 12 MB body cap that exists for KYC photos. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function uploadMedia(req: Request, res: Response): Promise<Response> {
  const { image } = req.body;
  if (!image || typeof image !== "string") throw ApiError.badRequest("Image base64 data is required");

  // This route is reachable by every admin role (it backs both the vehicle
  // catalog and promotions screens, so it can't be scoped to one permission).
  // Validate what's actually being uploaded instead: a base64 image data URL of
  // a sane type and size, rather than any string the caller cares to send.
  const match = /^data:image\/([a-z0-9.+-]+);base64,(.+)$/i.exec(image.trim());
  if (!match) {
    throw ApiError.badRequest("Image must be a base64 data URL, e.g. data:image/png;base64,…");
  }

  const [, subtype, payload] = match;
  if (!ALLOWED_IMAGE_TYPES.includes(subtype.toLowerCase())) {
    throw ApiError.badRequest(`Unsupported image type "${subtype}". Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`);
  }

  // base64 encodes 3 bytes as 4 chars; padding shaves off up to 2 bytes.
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  const bytes = Math.floor((payload.length * 3) / 4) - padding;
  if (bytes > MAX_UPLOAD_BYTES) {
    throw ApiError.badRequest(`Image is too large (${Math.round(bytes / 1024 / 1024)} MB). Maximum is 5 MB.`);
  }

  // A rejection from Cloudinary (corrupt file, quota, bad credentials) is not a
  // server fault — surface it as a 400 the admin can act on rather than an
  // opaque 500.
  let imageUrl: string;
  try {
    imageUrl = await uploadImage(image.trim());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw ApiError.badRequest(`Image upload failed: ${message}`);
  }
  return ok(res, { imageUrl }, "Image uploaded successfully");
}

// Roles CRUD
export async function listRoles(_req: Request, res: Response): Promise<Response> {
  const roles = await AdminRole.find().sort({ createdAt: -1 });
  return ok(res, roles);
}

export async function createRole(req: Request, res: Response): Promise<Response> {
  const { name, permissions } = req.body;
  if (!name || typeof name !== "string") throw ApiError.badRequest("Role name is required");
  const existing = await AdminRole.findOne({ name: name.trim() });
  if (existing) throw ApiError.badRequest("Role with this name already exists");

  const role = await AdminRole.create({
    name: name.trim(),
    permissions: Array.isArray(permissions) ? permissions : [],
  });
  return created(res, role, "Role created successfully");
}

export async function updateRole(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  const { name, permissions } = req.body;
  if (!name || typeof name !== "string") throw ApiError.badRequest("Role name is required");

  const role = await AdminRole.findById(id);
  if (!role) throw ApiError.notFound("Role not found");

  const existing = await AdminRole.findOne({ name: name.trim(), _id: { $ne: id } });
  if (existing) throw ApiError.badRequest("Another role with this name already exists");

  role.name = name.trim();
  role.permissions = Array.isArray(permissions) ? permissions : [];
  await role.save();
  return ok(res, role, "Role updated successfully");
}

export async function deleteRole(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  const role = await AdminRole.findById(id);
  if (!role) throw ApiError.notFound("Role not found");

  // Verify if assigned to any staff
  const staffCount = await User.countDocuments({ adminRoleId: id });
  if (staffCount > 0) {
    throw ApiError.badRequest("Cannot delete role as it is assigned to existing staff members");
  }

  await role.deleteOne();
  return ok(res, { success: true }, "Role deleted successfully");
}

// Staff CRUD
export async function listStaff(_req: Request, res: Response): Promise<Response> {
  const staff = await User.find({ role: "admin", phone: { $ne: `admin:${env.adminEmail}` } })
    .populate("adminRoleId")
    .sort({ createdAt: -1 });
  return ok(res, staff);
}

export async function createStaff(req: Request, res: Response): Promise<Response> {
  const { name, email, password, adminRoleId } = req.body;
  if (!name || !email || !password || !adminRoleId) {
    throw ApiError.badRequest("Name, email, password, and role are required");
  }
  const emailLower = email.trim().toLowerCase();
  if (emailLower === env.adminEmail.toLowerCase()) {
    throw ApiError.badRequest("Cannot create staff user with superadmin email");
  }

  const existing = await User.findOne({ email: emailLower });
  if (existing) {
    throw ApiError.badRequest("A user with this email already exists");
  }

  const role = await AdminRole.findById(adminRoleId);
  if (!role) throw ApiError.notFound("Assigned role not found");

  const phone = `admin-staff:${emailLower}`;
  const hashedPassword = hashPassword(password);

  const staff = await User.create({
    name: name.trim(),
    email: emailLower,
    phone,
    password: hashedPassword,
    role: "admin",
    adminRoleId,
  });

  return created(res, staff, "Staff account created successfully");
}

export async function updateStaff(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  const { name, email, password, adminRoleId } = req.body;
  if (!name || !email || !adminRoleId) {
    throw ApiError.badRequest("Name, email, and role are required");
  }
  const emailLower = email.trim().toLowerCase();
  if (emailLower === env.adminEmail.toLowerCase()) {
    throw ApiError.badRequest("Cannot update staff user to superadmin email");
  }

  const staff = await User.findById(id);
  if (!staff || staff.role !== "admin") {
    throw ApiError.notFound("Staff member not found");
  }

  if (emailLower !== staff.email) {
    const existing = await User.findOne({ email: emailLower });
    if (existing) {
      throw ApiError.badRequest("A user with this email already exists");
    }
    staff.phone = `admin-staff:${emailLower}`;
  }

  const role = await AdminRole.findById(adminRoleId);
  if (!role) throw ApiError.notFound("Assigned role not found");

  staff.name = name.trim();
  staff.email = emailLower;
  staff.adminRoleId = adminRoleId;

  if (password && password.trim() !== "") {
    staff.password = hashPassword(password);
  }

  await staff.save();
  return ok(res, staff, "Staff account updated successfully");
}

export async function deleteStaff(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  const staff = await User.findById(id);
  if (!staff || staff.role !== "admin") {
    throw ApiError.notFound("Staff member not found");
  }
  await staff.deleteOne();
  return ok(res, { success: true }, "Staff account deleted successfully");
}



