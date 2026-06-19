import type { Request, Response, NextFunction } from "express";
import { verifyToken, type Role } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";

/** Requires a valid Bearer JWT; sets req.userId and req.userRole. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Missing authentication token");
  }
  try {
    const payload = verifyToken(header.slice(7));
    req.userId = payload.sub;
    req.userRole = payload.role;
    next();
  } catch {
    throw ApiError.unauthorized("Invalid or expired token");
  }
}

/** Requires the authenticated user to have one of the given roles. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    requireAuth(req, _res, () => {
      if (!req.userRole || !roles.includes(req.userRole)) {
        throw ApiError.forbidden("You don't have access to this resource");
      }
      next();
    });
  };
}
