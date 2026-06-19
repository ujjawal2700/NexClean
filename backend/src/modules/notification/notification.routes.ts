import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { requireAuth } from "../../shared/middleware/auth";
import * as controller from "./notification.controller";

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

notificationRouter.post("/register-token", asyncHandler(controller.registerToken));
notificationRouter.get("/", asyncHandler(controller.list));
notificationRouter.patch("/read", asyncHandler(controller.markRead));
