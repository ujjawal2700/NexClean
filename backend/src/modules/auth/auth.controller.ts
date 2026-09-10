import type { Request, Response } from "express";
import { ok } from "../../shared/utils/apiResponse";
import { setSessionCookie, clearSessionCookies } from "../../shared/utils/sessionCookie";
import type { Role } from "../../shared/utils/jwt";
import * as authService from "./auth.service";

export async function sendOtp(req: Request, res: Response): Promise<Response> {
  const result = await authService.sendOtp(req.body.phone);
  return ok(res, result, "OTP sent");
}

export async function sendSignupOtp(req: Request, res: Response): Promise<Response> {
  const result = await authService.sendSignupOtp(req.body.phone);
  return ok(res, result, "OTP sent");
}

export async function sendLoginOtp(req: Request, res: Response): Promise<Response> {
  const result = await authService.sendLoginOtp(req.body.phone);
  return ok(res, result, "OTP sent");
}

export async function verifyOtpCodeOnly(req: Request, res: Response): Promise<Response> {
  const result = await authService.verifyOtpCodeOnly(req.body.phone, req.body.code);
  return ok(res, result, "Code verified");
}

export async function verifyOtp(req: Request, res: Response): Promise<Response> {
  const { token, user } = await authService.verifyOtp(req.body.phone, req.body.code);
  // The browser session lives in an httpOnly cookie. The token stays in the
  // body for API clients and the test suite; the web app ignores it.
  setSessionCookie(res, user.role as Role, token);
  return ok(res, { token, user }, "Logged in");
}

export async function adminLogin(req: Request, res: Response): Promise<Response> {
  const { token, user } = await authService.adminLogin(req.body.email, req.body.password);
  setSessionCookie(res, "admin", token);
  return ok(res, { token, user }, "Logged in");
}

/** Clear the session cookie(s) for this browser. */
export async function logout(req: Request, res: Response): Promise<Response> {
  const role = String(req.body?.role ?? "").toLowerCase();
  clearSessionCookies(res, (["customer", "agent", "admin"].includes(role) ? role : undefined) as Role | undefined);
  return ok(res, { loggedOut: true }, "Logged out");
}

export async function customerSignup(req: Request, res: Response): Promise<Response> {
  // req.ip is meaningful because app.ts sets "trust proxy" for nginx.
  const result = await authService.customerSignup(req.body, {
    ip: req.ip,
    deviceId: String(req.get("x-device-id") ?? ""),
  });
  return ok(res, result, "Account created — verification code sent");
}

export async function agentSignup(req: Request, res: Response): Promise<Response> {
  const result = await authService.agentSignup(req.body);
  setSessionCookie(res, "agent", result.token);
  return ok(res, result, "Application submitted");
}

export async function agentSignupBasic(req: Request, res: Response): Promise<Response> {
  const result = await authService.agentSignupBasic(req.body);
  setSessionCookie(res, "agent", result.token);
  return ok(res, result, "Account created, OTP verified");
}

export async function me(req: Request, res: Response): Promise<Response> {
  const user = await authService.getMe(req.userId!);
  return ok(res, user);
}
