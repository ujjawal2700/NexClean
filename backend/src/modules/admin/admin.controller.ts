import type { Request, Response } from "express";
import { z } from "zod";
import { ok, created } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import { getPricing, updatePricing } from "../pricing/pricing.service";
import * as service from "./admin.service";

export async function stats(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.stats());
}

export async function bookings(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listBookings());
}

export async function cancelBooking(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.cancelBooking(String(req.params.id)), "Booking cancelled");
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
  packages: z.array(z.object({ id: z.string(), name: z.string(), factor: z.number() })).optional(),
});
export async function updatePricingCtl(req: Request, res: Response): Promise<Response> {
  const parsed = pricingSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid pricing");
  return ok(res, await updatePricing(parsed.data), "Pricing updated");
}

export async function plans(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listPlans());
}

export async function campaigns(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listCampaigns());
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
