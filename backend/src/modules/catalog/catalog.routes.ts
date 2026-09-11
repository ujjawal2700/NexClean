import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import {
  getPackages,
  getPlans,
  getContentCtl,
  getPromoBannersCtl,
  getOffPeakHoursCtl,
  getPaymentModeCtl,
  getVehicleCategoriesCtl,
  getVehicleBrandsCtl,
  getVehicleModelsCtl,
  getCitiesCtl,
  getZonesByCityCtl,
  getServiceCheckCtl,
} from "./catalog.controller";

export const catalogRouter = Router();

// Public catalog endpoints
catalogRouter.get("/packages", getPackages);
catalogRouter.get("/plans", asyncHandler(getPlans));
catalogRouter.get("/content", asyncHandler(getContentCtl));
catalogRouter.get("/promo-banners", asyncHandler(getPromoBannersCtl));
catalogRouter.get("/off-peak-hours", asyncHandler(getOffPeakHoursCtl));
catalogRouter.get("/payment-mode", getPaymentModeCtl);
catalogRouter.get("/vehicle-categories", asyncHandler(getVehicleCategoriesCtl));
catalogRouter.get("/vehicle-brands", asyncHandler(getVehicleBrandsCtl));
catalogRouter.get("/vehicle-brands/:id/models", asyncHandler(getVehicleModelsCtl));
// Public location endpoints — used in customer signup city/society picker
catalogRouter.get("/cities", asyncHandler(getCitiesCtl));
catalogRouter.get("/zones", asyncHandler(getZonesByCityCtl));
// Geofence coverage check — independent of city, used at address-add time
catalogRouter.get("/service-check", asyncHandler(getServiceCheckCtl));

