import type { Request, Response } from "express";
import { ok } from "../../shared/utils/apiResponse";
import * as authService from "./auth.service";

export async function sendOtp(req: Request, res: Response): Promise<Response> {
  const result = await authService.sendOtp(req.body.phone);
  return ok(res, result, "OTP sent");
}

export async function sendSignupOtp(req: Request, res: Response): Promise<Response> {
  const result = await authService.sendSignupOtp(req.body.phone);
  return ok(res, result, "OTP sent");
}

export async function verifyOtpCodeOnly(req: Request, res: Response): Promise<Response> {
  const result = await authService.verifyOtpCodeOnly(req.body.phone, req.body.code);
  return ok(res, result, "Code verified");
}

export async function verifyOtp(req: Request, res: Response): Promise<Response> {
  const { token, user } = await authService.verifyOtp(req.body.phone, req.body.code);
  return ok(res, { token, user }, "Logged in");
}

export async function adminLogin(req: Request, res: Response): Promise<Response> {
  const { token, user } = await authService.adminLogin(req.body.email, req.body.password);
  return ok(res, { token, user }, "Logged in");
}

export async function customerSignup(req: Request, res: Response): Promise<Response> {
  const result = await authService.customerSignup(req.body);
  return ok(res, result, "Account created — verification code sent");
}

export async function agentSignup(req: Request, res: Response): Promise<Response> {
  const result = await authService.agentSignup(req.body);
  return ok(res, result, "Application submitted");
}

export async function agentSignupBasic(req: Request, res: Response): Promise<Response> {
  const result = await authService.agentSignupBasic(req.body);
  return ok(res, result, "Account created, OTP verified");
}

export async function me(req: Request, res: Response): Promise<Response> {
  const user = await authService.getMe(req.userId!);
  return ok(res, user);
}
