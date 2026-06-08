/** Augments Express Request with the authenticated user id set by auth middleware. */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
