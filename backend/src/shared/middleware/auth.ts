import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";

/** Requires a valid Bearer JWT; sets req.userId. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Missing authentication token");
  }
  try {
    const payload = verifyToken(header.slice(7));
    req.userId = payload.sub;
    next();
  } catch {
    throw ApiError.unauthorized("Invalid or expired token");
  }
}
