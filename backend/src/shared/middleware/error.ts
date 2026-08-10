import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { debugErrors } from "../../config/env";

/** 404 handler for unmatched routes. */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Translate the framework/driver errors that are really client mistakes into
 * 4xx responses. Without this every one of them surfaced as a 500: a malformed
 * ObjectId in a URL, a bad JSON body, or a duplicate key all looked like the
 * server had crashed, which buries genuine faults in the noise.
 */
function classify(err: unknown): { statusCode: number; message: string; details?: unknown } | null {
  if (err instanceof ApiError) {
    return { statusCode: err.statusCode, message: err.message, details: err.details };
  }
  if (typeof err !== "object" || err === null) return null;
  const e = err as { name?: string; type?: string; code?: number; message?: string; errors?: unknown };

  // body-parser: unparseable JSON body.
  if (e.type === "entity.parse.failed") return { statusCode: 400, message: "Malformed JSON body" };
  // body-parser: payload above the configured limit.
  if (e.type === "entity.too.large") return { statusCode: 413, message: "Payload too large" };
  // Mongoose: a value that can't be cast, most often a bad :id in the path.
  if (e.name === "CastError") return { statusCode: 400, message: "Invalid identifier" };
  // Mongoose: schema validation.
  if (e.name === "ValidationError") return { statusCode: 400, message: "Validation failed", details: e.errors };
  // MongoDB: unique index violation.
  if (e.code === 11000) return { statusCode: 409, message: "That value is already taken" };

  return null;
}

/** Central error formatter → { success: false, message, details? }. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const classified = classify(err);
  const statusCode = classified?.statusCode ?? 500;
  const message = classified?.message ?? "Internal server error";

  // Only genuinely unexpected failures are worth a stack in the log.
  if (!classified) console.error(err);

  res.status(statusCode).json({
    success: false,
    message,
    details: classified?.details,
    // Stack traces are debug output, never part of an API response. This was
    // gated on `!isProd`, and backend/.env ships NODE_ENV=development, so a
    // real deployment handed its internals to any client that sent a bad id.
    ...(debugErrors ? { stack: err instanceof Error ? err.stack : undefined } : {}),
  });
}
