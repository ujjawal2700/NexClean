import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";
import type { Request, Response } from "express";
import { env } from "../../config/env";
import { ApiError } from "../utils/ApiError";

/**
 * Rate limiters for the endpoints that cost money or guard an account.
 *
 * Storage is in-memory, which means limits are per-process. Under PM2 cluster
 * mode each worker keeps its own counters, so the effective limit is roughly
 * (limit × workers) — still a hard ceiling on the abuse this is here to stop
 * (OTP brute force, SMS billing, admin password guessing), just a looser one.
 * If that becomes too loose, swap in a Redis store; REDIS_URL is already
 * configured for the Socket.IO adapter.
 */

/** Tests and dev hammer these endpoints deliberately; limiting them there is noise. */
const disabled = env.nodeEnv === "test" || env.nodeEnv === "development" || env.allowDemoLogin;

function base(opts: { windowMs: number; limit: number; message: string; keyGenerator?: Options["keyGenerator"] }) {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => disabled,
    keyGenerator: opts.keyGenerator,
    // Route the rejection through the app's normal error envelope rather than
    // express-rate-limit's default text body.
    handler: (_req: Request, _res: Response, next) => next(ApiError.tooManyRequests(opts.message)),
  });
}

/**
 * Key on the phone number when present, so one attacker rotating IPs still
 * hits a per-account ceiling. `ipKeyGenerator` normalizes IPv6 properly —
 * using req.ip directly would let an attacker walk a /64 for free.
 */
const phoneOrIp: Options["keyGenerator"] = (req) => {
  const phone = (req.body as { phone?: unknown } | undefined)?.phone;
  if (typeof phone === "string" && phone.trim()) return `phone:${phone.replace(/\s+/g, "")}`;
  return ipKeyGenerator(req.ip ?? "");
};

/** OTP sends: each one bills a real SMS. */
export const sendOtpLimiter = base({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: "Too many code requests. Please wait a few minutes and try again.",
  keyGenerator: phoneOrIp,
});

/** OTP verification: the second line of defence behind MAX_OTP_ATTEMPTS. */
export const verifyOtpLimiter = base({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many attempts. Please wait a few minutes and try again.",
  keyGenerator: phoneOrIp,
});

/** Admin password guessing. */
export const adminLoginLimiter = base({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many login attempts. Please wait a few minutes and try again.",
});

/** Cleaner-initiated pushes to every customer in an area. */
export const areaAlertLimiter = base({
  windowMs: 60 * 60 * 1000,
  limit: 6,
  message: "You've sent several area alerts recently. Please wait before sending another.",
});
