import type { Request, Response } from "express";
import { ok } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import { PACKAGES, BASE_PRICE, VEHICLE_TYPES, isVehicleType } from "./catalog.data";
import { listActivePlans } from "./plan.service";
import { getContent } from "../content/content.service";
import { listActivePromoBanners } from "../promotions/promoBanner.service";
import { listActiveBrands } from "../brand/brand.service";

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

export async function getPromoBannersCtl(_req: Request, res: Response): Promise<Response> {
  return ok(res, await listActivePromoBanners());
}

/** Active brands (with their models) for a vehicle type — used by the Add Vehicle / booking pickers. */
export async function getVehicleBrandsCtl(req: Request, res: Response): Promise<Response> {
  const type = req.query.type;
  if (typeof type !== "string" || !isVehicleType(type)) throw ApiError.badRequest("A valid vehicle type is required");
  return ok(res, await listActiveBrands(type));
}
