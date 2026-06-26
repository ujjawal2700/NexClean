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
