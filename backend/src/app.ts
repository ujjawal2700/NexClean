import express, { type Application, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env, isProd } from "./config/env";
import { isDbConnected } from "./config/db";
import { apiRouter } from "./routes";
import { notFound, errorHandler } from "./shared/middleware/error";

/** Build the configured Express application. */
export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow non-browser requests (no Origin), a "*" wildcard, or any
        // configured origin (compared with trailing slashes normalized away).
        const normalized = origin?.replace(/\/+$/, "");
        if (!origin || env.clientOrigins.includes("*") || env.clientOrigins.includes(normalized!)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} is not allowed by CORS`));
        }
      },
      credentials: true,
    }),
  );
  app.use(express.json());
  if (!isProd) app.use(morgan("dev"));

  // Health check — works even if the database is unreachable.
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      success: true,
      status: "ok",
      db: isDbConnected() ? "connected" : "disconnected",
      time: new Date().toISOString(),
    });
  });

  app.use("/api", apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
