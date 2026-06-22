import type { Request, Response } from "express";
import { ok } from "../../shared/utils/apiResponse";
import { PACKAGES, BASE_PRICE, VEHICLE_TYPES } from "./catalog.data";
import { listActivePlans } from "./plan.service";
import { getContent } from "../content/content.service";

export function getPackages(_req: Request, res: Response): Response {
  return ok(res, PACKAGES);
}

export async function getContentCtl(_req: Request, res: Response): Promise<Response> {
  return ok(res, await getContent());
}

export function getPricing(_req: Request, res: Response): Response {
  return ok(res, { vehicleTypes: VEHICLE_TYPES, basePrice: BASE_PRICE });
}

export async function getPlans(_req: Request, res: Response): Promise<Response> {
  return ok(res, await listActivePlans());
}
