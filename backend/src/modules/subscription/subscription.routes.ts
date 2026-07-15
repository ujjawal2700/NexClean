import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { requireAuth } from "../../shared/middleware/auth";
import { validateBody } from "../../shared/middleware/validate";
import {
  previewSubscriptionSchema,
  subscriptionOrderSchema,
  verifySubscriptionSchema,
} from "./subscription.validation";
import * as subController from "./subscription.controller";

export const subscriptionRouter = Router();

subscriptionRouter.use(requireAuth);

subscriptionRouter.post("/preview", validateBody(previewSubscriptionSchema), asyncHandler(subController.previewSubscription));
subscriptionRouter.post("/order", validateBody(subscriptionOrderSchema), asyncHandler(subController.createSubscriptionOrder));
subscriptionRouter.post("/verify", validateBody(verifySubscriptionSchema), asyncHandler(subController.verifySubscription));
subscriptionRouter.delete("/", asyncHandler(subController.unsubscribe));

subscriptionRouter.get("/schedule", asyncHandler(subController.getSubscriptionSchedule));
subscriptionRouter.post("/schedule", asyncHandler(subController.scheduleSubscriptionWash));
subscriptionRouter.patch("/schedule/:bookingId", asyncHandler(subController.rescheduleSubscriptionWash));
