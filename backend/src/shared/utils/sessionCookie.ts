import type { Request, Response } from "express";
import { isProd } from "../../config/env";
import type { Role } from "./jwt";

/**
 * Session cookies.
 *
 * The token used to live in localStorage, which means any script injected into
 * the page could read it and walk away with a long-lived credential. An
 * httpOnly cookie is unreadable from JavaScript: an XSS can still act as the
 * user while the page is open, but it cannot exfiltrate the session.
 *
 * One cookie per role, because the apps deliberately keep separate sessions
 * (an admin and a customer can be signed in side by side) and a single cookie
 * would make them clobber each other.
 *
 * SameSite=Lax is the CSRF defence: nginx serves the SPA and proxies the API on
 * the same site in production, so Lax costs nothing and blocks the cookie from
 * riding along on cross-site POSTs. `secure` is off outside production so it
 * still works over plain http on localhost.
 */
const COOKIE_BY_ROLE: Record<Role, string> = {
  customer: "nc_session_customer",
  agent: "nc_session_agent",
  admin: "nc_session_admin",
};

/** Roughly matches the JWT lifetime so the cookie doesn't outlive the token. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function sessionCookieName(role: Role): string {
  return COOKIE_BY_ROLE[role];
}

export function setSessionCookie(res: Response, role: Role, token: string): void {
  res.cookie(COOKIE_BY_ROLE[role], token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: MAX_AGE_MS,
    path: "/",
  });
}

export function clearSessionCookies(res: Response, role?: Role): void {
  const names = role ? [COOKIE_BY_ROLE[role]] : Object.values(COOKIE_BY_ROLE);
  for (const name of names) {
    res.clearCookie(name, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/" });
  }
}

/** Parse the Cookie header. Avoids pulling in cookie-parser for ~10 lines. */
function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    if (k) out[k] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

/**
 * The session token for this request.
 *
 * An explicit Authorization header wins over the cookie. That ordering matters:
 * the cookie is *ambient* — the browser (and Playwright's request context, and
 * curl with a jar) attaches it to everything — so if a caller has gone to the
 * trouble of naming a credential, a stale cookie from an earlier session must
 * not silently override it and authenticate them as somebody else.
 *
 * For browser sessions there is no header, so the cookie is used.
 * `X-Session-Role` says which app is calling, mirroring the route-prefix logic
 * the client already used, so three role sessions can coexist in one browser.
 */
export function readSessionToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);

  const cookies = parseCookies(req.headers.cookie);

  const hinted = String(req.get("x-session-role") ?? "").toLowerCase() as Role;
  if (hinted && COOKIE_BY_ROLE[hinted] && cookies[COOKIE_BY_ROLE[hinted]]) {
    return cookies[COOKIE_BY_ROLE[hinted]];
  }
  for (const name of Object.values(COOKIE_BY_ROLE)) {
    if (cookies[name]) return cookies[name];
  }
  return null;
}

/**
 * True when this request authenticated via cookie rather than a Bearer header.
 * Mirrors the precedence above: a request naming an Authorization header is
 * header-authenticated even if a cookie also happens to be attached, and so is
 * not a CSRF candidate.
 */
export function usedCookieAuth(req: Request): boolean {
  if (req.headers.authorization?.startsWith("Bearer ")) return false;
  const cookies = parseCookies(req.headers.cookie);
  return Object.values(COOKIE_BY_ROLE).some((n) => Boolean(cookies[n]));
}
