import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { requireRole } from "../../shared/middleware/auth";
import * as controller from "./areaAlert.controller";

export const areaAlertRouter = Router();

// Settings are admin-managed; triggering is an agent (or admin) action.
areaAlertRouter.get("/settings", requireRole("admin"), asyncHandler(controller.getSettings));
areaAlertRouter.put("/settings", requireRole("admin"), asyncHandler(controller.updateSettings));
areaAlertRouter.post("/trigger", requireRole("agent", "admin"), asyncHandler(controller.trigger));
areaAlertRouter.get("/triggered", requireRole("admin", "agent"), asyncHandler(controller.listTriggered));
