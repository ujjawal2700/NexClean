import type { Request, Response } from "express";
import { ok } from "../../shared/utils/apiResponse";
import { setSessionCookie, clearSessionCookies, readSessionToken } from "../../shared/utils/sessionCookie";
import { verifyToken, type Role } from "../../shared/utils/jwt";
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
  const result = await authService.sendLoginOtp(req.body.phone, req.body.role);
  return ok(res, result, "OTP sent");
}

export async function verifyOtpCodeOnly(req: Request, res: Response): Promise<Response> {
  const result = await authService.verifyOtpCodeOnly(req.body.phone, req.body.code);
  return ok(res, result, "Code verified");
}

const deviceIdOf = (req: Request) => String(req.get("x-device-id") ?? "").trim().slice(0, 100);

export async function verifyOtp(req: Request, res: Response): Promise<Response> {
  const result = await authService.verifyOtp(req.body.phone, req.body.code, deviceIdOf(req));
  // Signed in on another phone: no session yet, the app asks the cleaner first.
  if ("deviceSwitchRequired" in result) return ok(res, result, "Signed in on another device");
  const { token, user } = result;
  // The browser session lives in an httpOnly cookie. The token stays in the
  // body for API clients and the test suite; the web app ignores it.
  setSessionCookie(res, user.role as Role, token);
  return ok(res, { token, user }, "Logged in");
}

export async function checkReferralCode(req: Request, res: Response): Promise<Response> {
  return ok(res, await authService.checkReferralCode(req.body.code, req.body.phone), "Referral code is valid");
}

export async function adminLogin(req: Request, res: Response): Promise<Response> {
  const { token, user } = await authService.adminLogin(req.body.email, req.body.password);
  setSessionCookie(res, "admin", token);
  return ok(res, { token, user }, "Logged in");
}

export async function requestAdminPasswordReset(req: Request, res: Response): Promise<Response> {
  const result = await authService.requestAdminPasswordReset(req.body.email);
  return ok(res, result, "If an active admin account exists, a reset code has been sent.");
}

export async function resetAdminPassword(req: Request, res: Response): Promise<Response> {
  const result = await authService.resetAdminPassword(req.body.email, req.body.code, req.body.newPassword);
  clearSessionCookies(res, "admin");
  return ok(res, result, "Password reset successfully. Sign in with your new password.");
}

/** The cleaner confirmed logging in on this phone and signing the other one out. */
export async function confirmAgentDeviceSwitch(req: Request, res: Response): Promise<Response> {
  const { token, user } = await authService.confirmAgentDeviceSwitch(String(req.body?.switchTicket ?? ""), deviceIdOf(req));
  setSessionCookie(res, "agent", token);
  return ok(res, { token, user }, "Logged in");
}

/** Clear the session cookie(s) for this browser. */
export async function logout(req: Request, res: Response): Promise<Response> {
  const role = String(req.body?.role ?? "").toLowerCase();
  if (role === "agent") {
    try {
      const raw = readSessionToken(req);
      const payload = raw ? verifyToken(raw) : null;
      if (payload?.role === "agent") {
        await authService.releaseAgentDevice(payload.sub, payload.ver ?? 0);
      }
    } catch {
      /* expired or foreign token — nothing of ours to release */
    }
  }
  clearSessionCookies(res, (["customer", "agent", "admin"].includes(role) ? role : undefined) as Role | undefined);
  return ok(res, { loggedOut: true }, "Logged out");
}

export async function customerSignup(req: Request, res: Response): Promise<Response> {
  // req.ip is meaningful because app.ts sets "trust proxy" for nginx.
  const result = await authService.customerSignup(req.body, {
    ip: req.ip,
    deviceId: String(req.get("x-device-id") ?? ""),
    userAgent: String(req.get("user-agent") ?? ""),
  });
  return ok(res, result, "Account created — verification code sent");
}

export async function agentSignup(req: Request, res: Response): Promise<Response> {
  const result = await authService.agentSignup(req.userId!, req.body, {
    ip: req.ip,
    deviceId: deviceIdOf(req),
    userAgent: String(req.get("user-agent") ?? ""),
  });
  setSessionCookie(res, "agent", result.token);
  return ok(res, result, "Application submitted");
}

export async function agentSignupBasic(req: Request, res: Response): Promise<Response> {
  const result = await authService.agentSignupBasic(req.body, {
    ip: req.ip,
    deviceId: deviceIdOf(req),
    userAgent: String(req.get("user-agent") ?? ""),
  });
  setSessionCookie(res, "agent", result.token);
  return ok(res, result, "Account created, OTP verified");
}

export async function me(req: Request, res: Response): Promise<Response> {
  const user = await authService.getMe(req.userId!);
  return ok(res, user);
}
