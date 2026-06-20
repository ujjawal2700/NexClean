import type { Request, Response } from "express";
import { z } from "zod";
import { ok, created } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import { getPricing, updatePricing } from "../pricing/pricing.service";
import * as locationService from "../location/location.service";
import * as service from "./admin.service";

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
  price: z.number().positive(),
  washesPerMonth: z.number().int(),
});
export async function createPlan(req: Request, res: Response): Promise<Response> {
  const parsed = createPlanSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Name, price and washes per month are required");
  return created(res, await service.createPlan(parsed.data), "Plan created");
}

const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.number().positive().optional(),
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
