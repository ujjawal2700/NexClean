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

/**
 * A cleaner proved their OTP on a new phone while signed in on another one.
 * Instead of a session they get this: a five-minute, single-purpose ticket the
 * new phone spends once the cleaner confirms "log out the other phone". The OTP
 * is already used up by then, so this is what carries the proof across the
 * confirmation popup. `ver` pins it to the account's sessions at issue time, so
 * it dies with them if anything else signs the account out meanwhile.
 */
type DeviceSwitchTicket = { sub: string; purpose: "agent_device_switch"; dev: string; ver: number };

export function signDeviceSwitchTicket(userId: string, deviceId: string, tokenVersion: number): string {
  const payload: DeviceSwitchTicket = { sub: userId, purpose: "agent_device_switch", dev: deviceId, ver: tokenVersion };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "5m" });
}

/** Returns the ticket's claims, or null if it is invalid, expired or not a switch ticket. */
export function verifyDeviceSwitchTicket(ticket: string): DeviceSwitchTicket | null {
  try {
    const decoded = jwt.verify(ticket, env.jwtSecret) as Partial<DeviceSwitchTicket>;
    if (decoded.purpose !== "agent_device_switch" || !decoded.sub || typeof decoded.dev !== "string") return null;
    return { sub: decoded.sub, purpose: decoded.purpose, dev: decoded.dev, ver: Number(decoded.ver ?? 0) };
  } catch {
    return null;
  }
}
