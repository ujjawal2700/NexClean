import type { Request, Response, NextFunction } from "express";
import { verifyToken, type Role } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";
import { User } from "../../modules/user/user.model";
import { env } from "../../config/env";

/** Requires a valid Bearer JWT; sets req.userId and req.userRole. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Missing authentication token");
  }
  let payload: ReturnType<typeof verifyToken>;
  try {
    payload = verifyToken(header.slice(7));
  } catch {
    throw ApiError.unauthorized("Invalid or expired token");
  }
  // `next()` runs outside the try/catch above: requireRole() calls this with a
  // synchronous callback that itself throws (403 for a wrong role), and that
  // must not be caught here and remapped to a misleading 401.
  req.userId = payload.sub;
  req.userRole = payload.role;
  next();
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

export function requirePermission(permission: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.userId) {
      throw ApiError.unauthorized("Authentication required");
    }
    const user = await User.findById(req.userId).populate("adminRoleId");
    if (!user || user.role !== "admin") {
      throw ApiError.forbidden("Admin access required");
    }

    // 1. Super Admin access
    if (user.phone === `admin:${env.adminEmail}` || !user.adminRoleId) {
      return next();
    }

    // 2. Custom Role access
    const role = user.adminRoleId as any;
    if (role && (role.permissions.includes(permission) || role.permissions.includes("*"))) {
      return next();
    }

    throw ApiError.forbidden(`You don't have access to the ${permission} section`);
  };
}
