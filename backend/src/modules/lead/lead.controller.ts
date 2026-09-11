import type { Request, Response } from "express";
import { z } from "zod";
import { ok, created } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import * as service from "./lead.service";

const createLeadSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  phone: z.string().regex(/^\+?[\d\s]{10,15}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  city: z.string().trim().min(1, "City is required"),
  location: z.string().trim().min(1, "Location is required"),
  deviceToken: z.string().optional(),
});

/** POST /leads — public, no auth required */
export async function createLead(req: Request, res: Response): Promise<Response> {
  const parsed = createLeadSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest(parsed.error.errors[0]?.message ?? "Invalid input");
  const lead = await service.createLead(parsed.data);
  return created(res, lead, "You're on our waitlist! We'll notify you when we launch in your city.");
}

const requestAreaSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().trim().max(200).optional(),
});

/**
 * POST /leads/area-request — authenticated. An existing customer's address
 * fell outside every drawn geofence (see catalog.controller.ts's
 * getServiceCheckCtl); this is the "request this area" follow-up.
 */
export async function requestArea(req: Request, res: Response): Promise<Response> {
  const parsed = requestAreaSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest(parsed.error.errors[0]?.message ?? "A valid location is required");
  const lead = await service.requestArea(req.userId!, parsed.data);
  return created(res, lead, "Thanks — we've noted your area and will reach out once we're live nearby.");
}

/** GET /admin/leads — admin only */
export async function listLeads(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listLeads());
}

/** DELETE /admin/leads/:id — admin only */
export async function deleteLead(req: Request, res: Response): Promise<Response> {
  await service.deleteLead(String(req.params.id));
  return ok(res, null, "Lead deleted");
}

/** PATCH /admin/leads/:id/status — admin only */
export async function updateLeadStatus(req: Request, res: Response): Promise<Response> {
  const status = String(req.body.status || "new");
  if (!["new", "contacted", "converted"].includes(status)) {
    throw ApiError.badRequest("Invalid lead status");
  }
  const lead = await service.updateLeadStatus(String(req.params.id), status as "new" | "contacted" | "converted");

  return ok(res, lead, "Lead status updated");
}

