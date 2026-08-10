import type { Role } from "../utils/jwt";

/** Augments Express Request with the authenticated user id + role. */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: Role;
      /** Token version carried by the JWT, compared against the account's current one. */
      tokenVersion?: number;
    }
  }
}

export {};
