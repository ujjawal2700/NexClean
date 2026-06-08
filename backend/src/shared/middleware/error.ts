import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { isProd } from "../../config/env";

/** 404 handler for unmatched routes. */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/** Central error formatter → { success: false, message, details? }. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const isApiError = err instanceof ApiError;
  const statusCode = isApiError ? err.statusCode : 500;
  const message = isApiError ? err.message : "Internal server error";

  if (!isApiError) console.error(err);

  res.status(statusCode).json({
    success: false,
    message,
    details: isApiError ? err.details : undefined,
    ...(isProd ? {} : { stack: err instanceof Error ? err.stack : undefined }),
  });
}
