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
        // In local development, also allow any localhost/127.0.0.1 port to prevent CORS blockages when ports shift.
        const normalized = origin ? origin.replace(/\/+$/, "") : "";
        if (
          !origin ||
          env.clientOrigins.includes("*") ||
          env.clientOrigins.includes(normalized) ||
          (!isProd && (normalized.startsWith("http://localhost:") || normalized.startsWith("http://127.0.0.1:")))
        ) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
    }),
  );
  // 12mb cap accommodates base64-encoded Aadhar KYC photos from agent signup.
  app.use(express.json({ limit: "12mb" }));
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
