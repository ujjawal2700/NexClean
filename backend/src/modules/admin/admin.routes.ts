import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { requireRole } from "../../shared/middleware/auth";
import * as c from "./admin.controller";

export const adminRouter = Router();

adminRouter.use(requireRole("admin"));

adminRouter.get("/stats", asyncHandler(c.stats));

adminRouter.get("/bookings", asyncHandler(c.bookings));
adminRouter.patch("/bookings/:id/cancel", asyncHandler(c.cancelBooking));

adminRouter.get("/agents", asyncHandler(c.agents));
adminRouter.patch("/agents/:id/status", asyncHandler(c.setAgentStatus));

adminRouter.get("/pricing", asyncHandler(c.pricing));
adminRouter.put("/pricing", asyncHandler(c.updatePricingCtl));

adminRouter.get("/plans", asyncHandler(c.plans));

adminRouter.get("/campaigns", asyncHandler(c.campaigns));
adminRouter.post("/campaigns", asyncHandler(c.sendCampaign));
