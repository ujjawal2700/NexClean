import type { Role } from "../utils/jwt";

/** Augments Express Request with the authenticated user id + role. */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: Role;
    }
  }
}

export {};
