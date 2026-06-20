import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { getPackages, getPricing, getPlans } from "./catalog.controller";

export const catalogRouter = Router();

// Public catalog endpoints
catalogRouter.get("/packages", getPackages);
catalogRouter.get("/pricing", getPricing);
catalogRouter.get("/plans", asyncHandler(getPlans));
