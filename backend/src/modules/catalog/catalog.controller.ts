import type { Request, Response } from "express";
import { ok } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import { PACKAGES } from "./catalog.data";
import { listActivePlans } from "./plan.service";
import { listActiveCategories } from "./category.service";
import { getContent } from "../content/content.service";
import { listActivePromoBanners } from "../promotions/promoBanner.service";
import { getOffPeakHoursConfig } from "../promotions/offPeakHours.service";
import { paymentsLive } from "../payment/razorpay";
import { listActiveBrands } from "../brand/brand.service";
import { listActiveModelsForBrand } from "../brand/vehicleModel.service";
import { City, ServiceZone } from "../location/location.model";
import { checkServiceability } from "../location/location.service";


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

/**
 * Off-peak windows, public so the booking screen can flag which slots are
 * discounted before the customer has typed a code. Read-only config with no
 * customer data in it, so it needs no auth — same footing as packages and
 * banners.
 */
export async function getOffPeakHoursCtl(_req: Request, res: Response): Promise<Response> {
  return ok(res, await getOffPeakHoursConfig());
}

/**
 * How money is collected right now.
 *
 * Public and auth-free — it exposes no more than the checkout screen reveals a
 * moment later. Screens need it *before* they act so a button can read "Pay
 * ₹600" when a gateway is live and "Pay ₹600 to your cleaner" when it isn't;
 * without it the label has to guess, and it guessed wrong the moment keys were
 * added.
 */
export function getPaymentModeCtl(_req: Request, res: Response): Response {
  return ok(res, { online: paymentsLive });
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

/**
 * Public endpoint: is this point inside a drawn geofence? The check behind
 * "we're not in your area yet" at address-add time — entirely independent of
 * city, which plays no part in dispatch or coverage. Query params: ?lat=&lng=
 */
export async function getServiceCheckCtl(req: Request, res: Response): Promise<Response> {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw ApiError.badRequest("lat and lng query params are required");
  }
  return ok(res, await checkServiceability([lng, lat]));
}
