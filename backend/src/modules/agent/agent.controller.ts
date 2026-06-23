import type { Request, Response } from "express";
import { z } from "zod";
import { ok } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import * as service from "./agent.service";

export async function jobs(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listJobs(req.userId!));
}

export async function summary(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.summary(req.userId!));
}

export async function advance(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.advanceStatus(req.userId!, String(req.params.id)), "Status updated");
}

const photoSchema = z.object({ kind: z.enum(["before", "after"]) });
export async function photo(req: Request, res: Response): Promise<Response> {
  const parsed = photoSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("kind must be 'before' or 'after'");
  return ok(res, await service.setPhoto(req.userId!, String(req.params.id), parsed.data.kind), "Photo added");
}

const onlineSchema = z.object({ online: z.boolean() });
export async function online(req: Request, res: Response): Promise<Response> {
  const parsed = onlineSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("online must be a boolean");
  return ok(res, await service.setOnline(req.userId!, parsed.data.online));
}

export async function heartbeat(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.heartbeat(req.userId!));
}

const notifySchema = z.object({ society: z.string().min(1) });
export async function notifyArea(req: Request, res: Response): Promise<Response> {
  const parsed = notifySchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("society is required");
  const record = await service.notifyArea(req.userId!, parsed.data.society);
  return ok(res, record, `Alert sent to ${record.sentCount} nearby customer(s)`);
}
