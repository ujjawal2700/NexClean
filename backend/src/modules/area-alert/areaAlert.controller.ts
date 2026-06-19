import type { Request, Response } from "express";
import { z } from "zod";
import { ok, created } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import * as service from "./areaAlert.service";

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  radiusKm: z.number().min(0.5).max(10).optional(),
  windowMinutes: z.number().min(5).max(180).optional(),
  title: z.string().min(1).max(80).optional(),
  body: z.string().min(1).max(300).optional(),
});

const triggerSchema = z.object({
  society: z.string().min(1),
  agentName: z.string().optional(),
});

export async function getSettings(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.getSettings());
}

export async function updateSettings(req: Request, res: Response): Promise<Response> {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Invalid settings", parsed.error.issues);
  return ok(res, await service.updateSettings(parsed.data), "Settings updated");
}

export async function trigger(req: Request, res: Response): Promise<Response> {
  const parsed = triggerSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("society is required");
  const record = await service.trigger(parsed.data.society, parsed.data.agentName);
  return created(res, record, `Alert sent to ${record.sentCount} nearby customer(s)`);
}

export async function listTriggered(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listTriggered());
}
