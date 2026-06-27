import type { Request, Response } from "express";
import { ok } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import { PACKAGES } from "./catalog.data";
import { listActivePlans } from "./plan.service";
import { listActiveCategories } from "./category.service";
import { getContent } from "../content/content.service";
import { listActivePromoBanners } from "../promotions/promoBanner.service";
import { listActiveBrands } from "../brand/brand.service";
import { listActiveModelsForBrand } from "../brand/vehicleModel.service";
import { City, ServiceZone } from "../location/location.model";


export function getPackages(_req: Request, res: Response): Response {
  return ok(res, PACKAGES);
}

export async function getContentCtl(_req: Request, res: Response): Promise<Response> {
  return ok(res, await getContent());
}

/** Active vehicle categories with their current base price — admin-managed, not a fixed list. */
export async function getVehicleCategoriesCtl(_req: Request, res: Response): Promise<Response> {
  return ok(res, await listActiveCategories());
}

export async function getPlans(_req: Request, res: Response): Promise<Response> {
  return ok(res, await listActivePlans());
}

export async function getPromoBannersCtl(_req: Request, res: Response): Promise<Response> {
  return ok(res, await listActivePromoBanners());
}

/** Active brands — used by the Add Vehicle / booking pickers (brand spans many categories). */
export async function getVehicleBrandsCtl(_req: Request, res: Response): Promise<Response> {
  return ok(res, await listActiveBrands());
}

/** Active models under a brand, each carrying its own category. */
export async function getVehicleModelsCtl(req: Request, res: Response): Promise<Response> {
  const brandId = String(req.params.id);
  if (!brandId) throw ApiError.badRequest("Brand id is required");
  return ok(res, await listActiveModelsForBrand(brandId));
}

/**
 * Public endpoint: returns all active cities admin has added.
 * Used in customer signup to show the city picker without requiring auth.
 */
export async function getCitiesCtl(_req: Request, res: Response): Promise<Response> {
  const cities = await City.find({ active: true }).sort({ name: 1 }).select("name active");
  return ok(
    res,
    cities.map((c) => ({ id: String(c._id), name: c.name, active: c.active })),
  );
}

/**
 * Public endpoint: returns all active zones/societies for a given city.
 * Query param: ?cityId=<id>
 */
export async function getZonesByCityCtl(req: Request, res: Response): Promise<Response> {
  const cityId = String(req.query.cityId ?? "");
  if (!cityId) throw ApiError.badRequest("cityId query param is required");
  const zones = await ServiceZone.find({ city: cityId, active: true }).sort({ name: 1 }).select("name active");
  return ok(
    res,
    zones.map((z) => ({ id: String(z._id), name: z.name })),
  );
}
