import type { Request, Response } from "express";
import { ok } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import * as subService from "./subscription.service";

export async function subscribe(req: Request, res: Response): Promise<Response> {
  const planId = String(req.body.planId ?? "");
  if (!subService.isPlanId(planId)) throw ApiError.badRequest("Unknown plan");
  const user = await subService.subscribe(req.userId!, planId);
  return ok(res, user, "Subscribed");
}

export async function unsubscribe(req: Request, res: Response): Promise<Response> {
  const user = await subService.unsubscribe(req.userId!);
  return ok(res, user, "Subscription cancelled");
}
