import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env";

export type Role = "customer" | "agent" | "admin";

/**
 * `ver` is the account's token version at the moment of issue.
 *
 * A JWT is self-contained, so before this the only way to stop one being
 * accepted was to wait out its (30-day) expiry — a stolen token was valid for
 * a month with no way to kill it. `requireAuth` now compares this against the
 * account's current `tokenVersion`, so bumping that number invalidates every
 * token issued for the user, instantly and everywhere.
 *
 * Tokens minted before this field existed have no `ver`; they are treated as
 * version 0, which matches the default on existing accounts so nobody is
 * logged out by the upgrade itself.
 */
export type JwtPayload = { sub: string; role: Role; ver?: number };

export function signToken(userId: string, role: Role, tokenVersion = 0): string {
  return jwt.sign({ sub: userId, role, ver: tokenVersion }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
