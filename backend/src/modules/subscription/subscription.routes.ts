import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { requireAuth } from "../../shared/middleware/auth";
import * as subController from "./subscription.controller";

export const subscriptionRouter = Router();

subscriptionRouter.use(requireAuth);

subscriptionRouter.post("/", asyncHandler(subController.subscribe));
subscriptionRouter.delete("/", asyncHandler(subController.unsubscribe));

subscriptionRouter.get("/schedule", asyncHandler(subController.getSubscriptionSchedule));
subscriptionRouter.post("/schedule", asyncHandler(subController.scheduleSubscriptionWash));
subscriptionRouter.patch("/schedule/:bookingId", asyncHandler(subController.rescheduleSubscriptionWash));
