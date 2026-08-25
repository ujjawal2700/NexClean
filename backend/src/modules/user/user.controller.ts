import type { Request, Response } from "express";
import { ok } from "../../shared/utils/apiResponse";
import * as userService from "./user.service";

export async function updateProfile(req: Request, res: Response): Promise<Response> {
  const user = await userService.updateProfile(req.userId!, req.body);
  return ok(res, user, "Profile updated");
}

export async function updatePasswordWithOtp(req: Request, res: Response): Promise<Response> {
  const result = await userService.updatePasswordWithOtp(req.userId!, req.body);
  return ok(res, result, "Password updated successfully");
}


export async function logoutEverywhere(req: Request, res: Response): Promise<Response> {
  const result = await userService.logoutEverywhere(req.userId!);
  return ok(res, result, "Signed out on all devices");
}

export async function deactivateAccount(req: Request, res: Response): Promise<Response> {
  const result = await userService.deactivateUser(req.userId!);
  return ok(res, result, "Account deactivated");
}


export async function requestPhoneChange(req: Request, res: Response): Promise<Response> {
  const result = await userService.requestPhoneChange(req.userId!, req.body.phone);
  return ok(res, result, "OTP sent");
}

export async function confirmPhoneChange(req: Request, res: Response): Promise<Response> {
  const user = await userService.confirmPhoneChange(req.userId!, req.body.phone, req.body.code);
  return ok(res, user, "Phone number updated");
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

export async function updateAddress(req: Request, res: Response): Promise<Response> {
  const user = await userService.updateAddress(req.userId!, String(req.params.id), req.body);
  return ok(res, user, "Address updated");
}

export async function removeAddress(req: Request, res: Response): Promise<Response> {
  const user = await userService.removeAddress(req.userId!, String(req.params.id));
  return ok(res, user, "Address removed");
}

export async function getReferralSummary(req: Request, res: Response): Promise<Response> {
  const summary = await userService.getReferralSummary(req.userId!);
  return ok(res, summary);
}
