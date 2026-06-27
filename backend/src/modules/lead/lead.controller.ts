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

/** GET /admin/leads — admin only */
export async function listLeads(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listLeads());
}

/** DELETE /admin/leads/:id — admin only */
export async function deleteLead(req: Request, res: Response): Promise<Response> {
  await service.deleteLead(String(req.params.id));
  return ok(res, null, "Lead deleted");
}
