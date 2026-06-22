import type { Request, Response } from "express";
import { z } from "zod";
import { ok, created } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import { getPricing, updatePricing } from "../pricing/pricing.service";
import * as locationService from "../location/location.service";
import * as service from "./admin.service";
import { getContent, updateContent } from "../content/content.service";

/** A positive price for every vehicle type. */
const pricesSchema = z.object({
  hatchback: z.number().positive(),
  sedan: z.number().positive(),
  suv: z.number().positive(),
  luxury: z.number().positive(),
  premium: z.number().positive(),
});

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
