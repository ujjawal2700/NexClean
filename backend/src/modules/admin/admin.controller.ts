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
import * as referralCampaignService from "../promotions/referralCampaign.service";
import * as promoBannerService from "../promotions/promoBanner.service";
import * as service from "./admin.service";
import { getContent, updateContent } from "../content/content.service";

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

export async function agents(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listAgents());
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

const createZoneSchema = z.object({ name: z.string().trim().min(1), cityId: z.string().min(1) });
export async function createZone(req: Request, res: Response): Promise<Response> {
  const parsed = createZoneSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Zone name and city are required");
  return created(res, await locationService.createZone(parsed.data), "Zone created");
}

const updateZoneSchema = z.object({
  name: z.string().trim().min(1).optional(),
  active: z.boolean().optional(),
  cityId: z.string().min(1).optional(),
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

/* --------------------------- Vehicle categories -------------------------- */

export async function vehicleCategories(_req: Request, res: Response): Promise<Response> {
  return ok(res, await categoryService.listCategories());
}

const createCategorySchema = z.object({ name: z.string().trim().min(1), basePrice: z.number().positive() });
export async function createVehicleCategory(req: Request, res: Response): Promise<Response> {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Category name and base price are required");
  return created(res, await categoryService.createCategory(parsed.data), "Category created");
}

const updateCategorySchema = z.object({
  name: z.string().trim().min(1).optional(),
  basePrice: z.number().positive().optional(),
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

export async function referralCampaigns(_req: Request, res: Response): Promise<Response> {
  return ok(res, await referralCampaignService.listReferralCampaigns());
}

const createReferralCampaignSchema = z.object({
  name: z.string().trim().min(1),
  referrerReward: z.number().min(0),
  refereeReward: z.number().min(0),
  description: z.string().trim().optional(),
});
export async function createReferralCampaign(req: Request, res: Response): Promise<Response> {
  const parsed = createReferralCampaignSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid referral campaign");
  return created(res, await referralCampaignService.createReferralCampaign(parsed.data), "Referral campaign created");
}

const updateReferralCampaignSchema = z.object({
  name: z.string().trim().min(1).optional(),
  referrerReward: z.number().min(0).optional(),
  refereeReward: z.number().min(0).optional(),
  description: z.string().trim().optional(),
  active: z.boolean().optional(),
});
export async function updateReferralCampaign(req: Request, res: Response): Promise<Response> {
  const parsed = updateReferralCampaignSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid referral campaign update");
  return ok(
    res,
    await referralCampaignService.updateReferralCampaign(String(req.params.id), parsed.data),
    "Referral campaign updated",
  );
}

export async function deleteReferralCampaign(req: Request, res: Response): Promise<Response> {
  await referralCampaignService.deleteReferralCampaign(String(req.params.id));
  return ok(res, null, "Referral campaign deleted");
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

const campaignSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  audience: z.string().min(1),
});
export async function sendCampaign(req: Request, res: Response): Promise<Response> {
  const parsed = campaignSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Title, body and audience are required");
  const campaign = await service.sendCampaign(parsed.data);
  return created(res, campaign, `Sent to ${campaign.sentCount} customer(s)`);
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
