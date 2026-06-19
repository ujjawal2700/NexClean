import type { Request, Response } from "express";
import { ok } from "../../shared/utils/apiResponse";
import * as authService from "./auth.service";

export async function sendOtp(req: Request, res: Response): Promise<Response> {
  const result = await authService.sendOtp(req.body.phone);
  return ok(res, result, "OTP sent");
}

export async function verifyOtp(req: Request, res: Response): Promise<Response> {
  const { token, user } = await authService.verifyOtp(req.body.phone, req.body.code);
  return ok(res, { token, user }, "Logged in");
}

export async function adminLogin(req: Request, res: Response): Promise<Response> {
  const { token, user } = await authService.adminLogin(req.body.email, req.body.password);
  return ok(res, { token, user }, "Logged in");
}

export async function me(req: Request, res: Response): Promise<Response> {
  const user = await authService.getMe(req.userId!);
  return ok(res, user);
}
