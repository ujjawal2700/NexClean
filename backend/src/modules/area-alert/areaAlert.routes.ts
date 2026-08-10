import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { requireRole } from "../../shared/middleware/auth";
import { areaAlertLimiter } from "../../shared/middleware/rateLimit";
import * as controller from "./areaAlert.controller";

export const areaAlertRouter = Router();

// Settings are admin-managed; triggering is an agent (or admin) action.
areaAlertRouter.get("/settings", requireRole("admin"), asyncHandler(controller.getSettings));
areaAlertRouter.put("/settings", requireRole("admin"), asyncHandler(controller.updateSettings));
// Rate limited: one trigger pushes a notification to every customer in the
// named society, and nothing checks that the cleaner is actually working there.
areaAlertRouter.post("/trigger", requireRole("agent", "admin"), areaAlertLimiter, asyncHandler(controller.trigger));
areaAlertRouter.get("/triggered", requireRole("admin", "agent"), asyncHandler(controller.listTriggered));
