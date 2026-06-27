import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import {
  getPackages,
  getPlans,
  getContentCtl,
  getPromoBannersCtl,
  getVehicleCategoriesCtl,
  getVehicleBrandsCtl,
  getVehicleModelsCtl,
  getCitiesCtl,
  getZonesByCityCtl,
} from "./catalog.controller";

export const catalogRouter = Router();

// Public catalog endpoints
catalogRouter.get("/packages", getPackages);
catalogRouter.get("/plans", asyncHandler(getPlans));
catalogRouter.get("/content", asyncHandler(getContentCtl));
catalogRouter.get("/promo-banners", asyncHandler(getPromoBannersCtl));
catalogRouter.get("/vehicle-categories", asyncHandler(getVehicleCategoriesCtl));
catalogRouter.get("/vehicle-brands", asyncHandler(getVehicleBrandsCtl));
catalogRouter.get("/vehicle-brands/:id/models", asyncHandler(getVehicleModelsCtl));
// Public location endpoints — used in customer signup city/society picker
catalogRouter.get("/cities", asyncHandler(getCitiesCtl));
catalogRouter.get("/zones", asyncHandler(getZonesByCityCtl));

