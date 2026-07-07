import type { Request, Response } from "express";
import { ok } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import * as subService from "./subscription.service";

export async function subscribe(req: Request, res: Response): Promise<Response> {
  const planId = String(req.body.planId ?? "");
  if (!(await subService.isPlanId(planId))) throw ApiError.badRequest("Unknown plan");
  const user = await subService.subscribe(req.userId!, planId);
  return ok(res, user, "Subscribed");
}

export async function unsubscribe(req: Request, res: Response): Promise<Response> {
  const user = await subService.unsubscribe(req.userId!);
  return ok(res, user, "Subscription cancelled");
}

export async function getSubscriptionSchedule(req: Request, res: Response): Promise<Response> {
  const data = await subService.getSubscriptionSchedule(req.userId!);
  return ok(res, data);
}

export async function scheduleSubscriptionWash(req: Request, res: Response): Promise<Response> {
  const { vehicleId, addressId, date, slot } = req.body;
  if (!vehicleId || !addressId || !date || !slot) {
    throw ApiError.badRequest("vehicleId, addressId, date, and slot are required");
  }
  const booking = await subService.scheduleSubscriptionWash(req.userId!, { vehicleId, addressId, date, slot });
  return ok(res, booking, "Wash scheduled successfully");
}

export async function rescheduleSubscriptionWash(req: Request, res: Response): Promise<Response> {
  const bookingId = String(req.params.bookingId || "");
  const { date, slot } = req.body;
  if (!date || !slot) {
    throw ApiError.badRequest("date and slot are required");
  }
  const booking = await subService.rescheduleSubscriptionWash(req.userId!, bookingId, { date, slot });
  return ok(res, booking, "Wash rescheduled successfully");
}
