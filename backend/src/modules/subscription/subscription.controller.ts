import type { Request, Response } from "express";
import { ok } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import * as subService from "./subscription.service";
import { isValidSlot, SLOT_LIST } from "../../shared/slots";

export async function previewSubscription(req: Request, res: Response): Promise<Response> {
  const { planId, vehicleType, coinsToRedeem } = req.body;
  const result = await subService.previewSubscription(req.userId!, String(planId), vehicleType, coinsToRedeem);
  return ok(res, result);
}

export async function createSubscriptionOrder(req: Request, res: Response): Promise<Response> {
  const { planId, vehicleType, coinsToRedeem } = req.body;
  if (!(await subService.isPlanId(String(planId ?? "")))) throw ApiError.badRequest("Unknown plan");
  const order = await subService.createSubscriptionOrder(req.userId!, { planId: String(planId), vehicleType, coinsToRedeem });
  return ok(res, order);
}

export async function verifySubscription(req: Request, res: Response): Promise<Response> {
  const { planId, vehicleType, coinsToRedeem, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!(await subService.isPlanId(String(planId ?? "")))) throw ApiError.badRequest("Unknown plan");
  const user = await subService.verifyAndSubscribe(req.userId!, {
    planId: String(planId),
    vehicleType,
    coinsToRedeem,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });
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
  if (!isValidSlot(slot)) throw ApiError.badRequest(`slot must be one of: ${SLOT_LIST}`);
  const booking = await subService.scheduleSubscriptionWash(req.userId!, { vehicleId, addressId, date, slot });
  return ok(res, booking, "Wash scheduled successfully");
}

export async function rescheduleSubscriptionWash(req: Request, res: Response): Promise<Response> {
  const bookingId = String(req.params.bookingId || "");
  const { date, slot } = req.body;
  if (!date || !slot) {
    throw ApiError.badRequest("date and slot are required");
  }
  if (!isValidSlot(slot)) throw ApiError.badRequest(`slot must be one of: ${SLOT_LIST}`);
  const booking = await subService.rescheduleSubscriptionWash(req.userId!, bookingId, { date, slot });
  return ok(res, booking, "Wash rescheduled successfully");
}
