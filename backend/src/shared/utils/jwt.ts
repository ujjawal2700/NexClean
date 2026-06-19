import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env";

export type Role = "customer" | "agent" | "admin";
export type JwtPayload = { sub: string; role: Role };

export function signToken(userId: string, role: Role): string {
  return jwt.sign({ sub: userId, role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
