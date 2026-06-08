import type { Request, Response } from "express";
import { ok } from "../../shared/utils/apiResponse";
import { PACKAGES, BASE_PRICE, VEHICLE_TYPES, PLANS } from "./catalog.data";

export function getPackages(_req: Request, res: Response): Response {
  return ok(res, PACKAGES);
}

export function getPricing(_req: Request, res: Response): Response {
  return ok(res, { vehicleTypes: VEHICLE_TYPES, basePrice: BASE_PRICE });
}

export function getPlans(_req: Request, res: Response): Response {
  return ok(res, PLANS);
}
