import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { requireAuth } from "../../shared/middleware/auth";
import * as controller from "./tracking.controller";

export const trackingRouter = Router();

// Every role tracks through the same endpoints; who may see which booking is
// decided per-booking in the service, not by the route's own role guard.
trackingRouter.use(requireAuth);

trackingRouter.get("/fleet", asyncHandler(controller.fleet));
trackingRouter.get("/agents/:id", asyncHandler(controller.agentLocation));
trackingRouter.get("/bookings/:id", asyncHandler(controller.snapshot));
