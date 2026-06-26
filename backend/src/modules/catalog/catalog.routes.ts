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
