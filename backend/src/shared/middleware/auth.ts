import type { Request, Response, NextFunction } from "express";
import { verifyToken, type Role } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";
import { isSuperAdmin } from "../utils/superAdmin";
import { User } from "../../modules/user/user.model";
import { readSessionToken } from "../utils/sessionCookie";

/**
 * Decode the session JWT onto the request. Throws 401 if missing/invalid.
 *
 * The token comes from an httpOnly cookie for browser sessions, falling back to
 * the Authorization header so API clients and the test suite are unaffected.
 */
function readToken(req: Request): void {
  const raw = readSessionToken(req);
  if (!raw) {
    throw ApiError.unauthorized("Missing authentication token");
  }
  let payload: ReturnType<typeof verifyToken>;
  try {
    payload = verifyToken(raw);
  } catch {
    throw ApiError.unauthorized("Invalid or expired token");
  }
  req.userId = payload.sub;
  req.userRole = payload.role;
  req.tokenVersion = payload.ver ?? 0;
}

/**
 * Reject tokens belonging to a suspended account.
 *
 * Tokens live 30 days and there is no revocation list, so suspension used to
 * be enforced only at OTP login — a cleaner removed for misconduct kept full
 * access for up to a month on the token already in their browser. One indexed
 * lookup per authenticated request buys real revocation.
 */
async function assertAccountActive(req: Request): Promise<void> {
  const user = await User.findById(req.userId).select("status tokenVersion").lean();
  if (!user) throw ApiError.unauthorized("Account no longer exists");
  if (user.status === "suspended") {
    throw ApiError.forbidden("ACCOUNT_DEACTIVATED: Your account is deactivated. Please contact customer support for assistance.");
  }
  // Real revocation: a JWT is self-contained, so the only way to stop honouring
  // one is to refuse tokens issued before the account's current version.
  // Bumped on logout-everywhere, password change, deactivation and suspension.
  if ((req.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
    throw ApiError.unauthorized("Session expired. Please sign in again.");
  }
}

/** Requires a valid Bearer JWT for an active account; sets req.userId/req.userRole. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  readToken(req);
  await assertAccountActive(req);
  next();
}

/** Requires the authenticated user to have one of the given roles. */
export function requireRole(...roles: Role[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    readToken(req);
    if (!req.userRole || !roles.includes(req.userRole)) {
      throw ApiError.forbidden("You don't have access to this resource");
    }
    await assertAccountActive(req);
    next();
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

    // 1. Super Admin access. Only the designated super-admin account gets a
    //    blanket pass — an ordinary admin with no role assigned used to land
    //    here too and silently inherit every permission, which fails open.
    if (isSuperAdmin(user)) {
      return next();
    }
    if (!user.adminRoleId) {
      throw ApiError.forbidden("No role assigned to your admin account. Ask a super admin to assign one.");
    }

    // 2. Custom Role access
    const role = user.adminRoleId as any;
    if (role && (role.permissions.includes(permission) || role.permissions.includes("*"))) {
      return next();
    }

    throw ApiError.forbidden(`You don't have access to the ${permission} section`);
  };
}
