import type { Request, Response } from "express";
import { ok } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import * as service from "./tracking.service";

function viewer(req: Request): service.Viewer {
  return { id: req.userId!, role: String(req.userRole) };
}

/** GET /tracking/bookings/:id — one booking's live tracking state. */
export async function snapshot(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.getTrackingSnapshot(String(req.params.id), viewer(req)));
}

/** GET /tracking/fleet — every in-flight job's live position (admin only). */
export async function fleet(req: Request, res: Response): Promise<Response> {
  if (req.userRole !== "admin") throw ApiError.forbidden("Admins only");
  return ok(res, await service.getFleetSnapshot());
}

/** GET /tracking/agents/:id — one agent's current position (admin only). */
export async function agentLocation(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.getAgentLocationSnapshot(String(req.params.id), viewer(req)));
}
