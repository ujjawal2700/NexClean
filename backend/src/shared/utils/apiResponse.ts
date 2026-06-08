import type { Response } from "express";

/** Standard success envelope: { success: true, data, message? }. */
export function ok<T>(res: Response, data: T, message?: string, status = 200): Response {
  return res.status(status).json({ success: true, message, data });
}

export function created<T>(res: Response, data: T, message?: string): Response {
  return ok(res, data, message, 201);
}
