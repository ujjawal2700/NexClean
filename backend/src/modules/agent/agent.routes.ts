import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { requireRole } from "../../shared/middleware/auth";
import * as controller from "./agent.controller";

export const agentRouter = Router();

agentRouter.use(requireRole("agent"));

agentRouter.get("/jobs", asyncHandler(controller.jobs));
agentRouter.get("/summary", asyncHandler(controller.summary));
agentRouter.patch("/jobs/:id/advance", asyncHandler(controller.advance));
agentRouter.post("/jobs/:id/photo", asyncHandler(controller.photo));
agentRouter.patch("/online", asyncHandler(controller.online));
agentRouter.patch("/heartbeat", asyncHandler(controller.heartbeat));
agentRouter.post("/notify-area", asyncHandler(controller.notifyArea));
