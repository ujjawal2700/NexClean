import type { Request, Response } from "express";
import { z } from "zod";
import { ok } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import * as service from "./notification.service";

const tokenSchema = z.object({ token: z.string().min(8) });

export async function registerToken(req: Request, res: Response): Promise<Response> {
  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("A valid device token is required");
  await service.registerToken(req.userId!, parsed.data.token);
  return ok(res, { registered: true }, "Device registered");
}

export async function list(req: Request, res: Response): Promise<Response> {
  const items = await service.listForUser(req.userId!);
  return ok(res, items);
}

export async function markRead(req: Request, res: Response): Promise<Response> {
  await service.markAllRead(req.userId!);
  return ok(res, { ok: true });
}
