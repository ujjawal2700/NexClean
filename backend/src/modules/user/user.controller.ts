import type { Request, Response } from "express";
import { ok } from "../../shared/utils/apiResponse";
import * as userService from "./user.service";

export async function updateProfile(req: Request, res: Response): Promise<Response> {
  const user = await userService.updateProfile(req.userId!, req.body.name);
  return ok(res, user, "Profile updated");
}

export async function addVehicle(req: Request, res: Response): Promise<Response> {
  const user = await userService.addVehicle(req.userId!, req.body);
  return ok(res, user, "Vehicle added");
}

export async function removeVehicle(req: Request, res: Response): Promise<Response> {
  const user = await userService.removeVehicle(req.userId!, String(req.params.id));
  return ok(res, user, "Vehicle removed");
}

export async function addAddress(req: Request, res: Response): Promise<Response> {
  const user = await userService.addAddress(req.userId!, req.body);
  return ok(res, user, "Address added");
}

export async function removeAddress(req: Request, res: Response): Promise<Response> {
  const user = await userService.removeAddress(req.userId!, String(req.params.id));
  return ok(res, user, "Address removed");
}

export async function getReferralSummary(req: Request, res: Response): Promise<Response> {
  const summary = await userService.getReferralSummary(req.userId!);
  return ok(res, summary);
}
