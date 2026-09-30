import express, { type Application, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env, isProd } from "./config/env";
import { isDbConnected } from "./config/db";
import { apiRouter } from "./routes";
import { notFound, errorHandler } from "./shared/middleware/error";
import { csrfGuard } from "./shared/middleware/csrf";

/** Build the configured Express application. */
export function createApp(): Application {
  const app = express();

  // Production runs behind a single nginx reverse proxy (see deploy.sh). Without
  // this, req.ip is always nginx's own address — every request on the internet
  // looks like one client, which silently defeats IP-based rate limiting and
  // makes any per-IP signal useless. `1` means "trust exactly one proxy hop";
  // `true` would trust a client-supplied X-Forwarded-For and be spoofable.
  app.set("trust proxy", 1);

  // CORS runs first so every response — including the 426 below and
  // preflight OPTIONS — carries CORS headers. Otherwise the browser masks the
  // real error as a generic CORS failure.
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
      // Every API call carries custom headers (X-Session-Role, X-Device-Id,
      // JSON Content-Type), so the browser sends an OPTIONS preflight before
      // each one when the API is on another origin. Without maxAge Chrome
      // re-checks every 5 seconds, doubling the request count; 2h is Chrome's cap.
      maxAge: 7200,
    }),
  );
  // Reject plaintext production traffic even if a proxy is accidentally
  // configured without its HTTP -> HTTPS redirect. `trust proxy` above makes
  // req.secure honor the first proxy's X-Forwarded-Proto value.
  app.use((req: Request, res: Response, next) => {
    if (isProd && !req.secure) {
      return res.status(426).json({
        success: false,
        message: "HTTPS is required.",
      });
    }
    next();
  });

  app.use(
    helmet({
      strictTransportSecurity: {
        maxAge: 63_072_000,
        includeSubDomains: true,
        preload: true,
      },
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

  // This allowlisted payload contains only values browser SDKs are designed to
  // receive. Server credentials (JWT, Firebase service account, payments,
  // Cloudinary, SMS and admin credentials) never enter this response.
  app.get("/api/config/public", (_req: Request, res: Response) => {
    const firebase = env.firebaseWebConfig;
    const hasFirebaseConfig = Boolean(
      firebase.apiKey &&
        firebase.projectId &&
        firebase.messagingSenderId &&
        firebase.appId &&
        firebase.vapidKey,
    );

    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    res.json({
      success: true,
      data: {
        googleMapsApiKey: env.googleMapsBrowserKey || null,
        firebase: hasFirebaseConfig ? firebase : null,
      },
    });
  });

  // Cookie sessions are attached by the browser automatically, so writes need
  // an origin check. Sits in front of every API route.
  app.use("/api", csrfGuard);
  app.use("/api", apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
