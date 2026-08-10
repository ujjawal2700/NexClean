import type { Request, Response, NextFunction } from "express";
import { env } from "../../config/env";
import { ApiError } from "../utils/ApiError";
import { usedCookieAuth } from "../utils/sessionCookie";

/** Methods that can change state and therefore need CSRF protection. */
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Origin check for cookie-authenticated writes.
 *
 * Moving the session into a cookie means the browser attaches it to *every*
 * request to this API, including ones triggered by another site — which is the
 * classic CSRF exposure that Bearer headers didn't have. `SameSite=Lax` already
 * stops the cookie riding along on cross-site POSTs in modern browsers; this is
 * the second layer, rejecting any state-changing request whose Origin isn't one
 * we serve.
 *
 * Deliberately narrow: requests authenticated by an Authorization header are
 * untouched (a cross-site attacker cannot set that header, and it keeps API
 * clients, mobile apps and the test suite working), and requests with no Origin
 * at all — curl, server-to-server — are left alone for the same reason.
 */
export function csrfGuard(req: Request, _res: Response, next: NextFunction): void {
  if (!UNSAFE.has(req.method)) return next();
  if (!usedCookieAuth(req)) return next();

  const origin = req.get("origin");
  if (!origin) return next();

  const normalized = origin.replace(/\/+$/, "");
  const allowed =
    env.clientOrigins.includes("*") ||
    env.clientOrigins.includes(normalized) ||
    (env.nodeEnv !== "production" &&
      (normalized.startsWith("http://localhost:") || normalized.startsWith("http://127.0.0.1:")));

  if (!allowed) {
    throw ApiError.forbidden("Cross-site request blocked");
  }
  next();
}
