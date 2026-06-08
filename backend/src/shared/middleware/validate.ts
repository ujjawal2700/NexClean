import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodType } from "zod";
import { ApiError } from "../utils/ApiError";

/** Validates and replaces req.body against a Zod schema. */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
        throw ApiError.badRequest("Validation failed", details);
      }
      throw err;
    }
  };
}
