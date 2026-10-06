import { createApp } from "./app";
import { connectDb } from "./config/db";
import { seedDemoData } from "./config/seed";
import { env, assertProductionConfig } from "./config/env";
import { initSocket } from "./shared/services/socket";
import { initFcm } from "./shared/services/fcm";
import { startDispatchWorker, resumeDispatch, stopDispatchWorker } from "./modules/dispatch/dispatch.service";
import { ensureNotificationRetention } from "./modules/notification/notificationRetention";
import { refreshSlotCache, startSlotCacheRefresh, stopSlotCacheRefresh } from "./modules/dispatch/slotConfig.service";

// Fail fast before binding a port: a production server running on development
// secrets is worse than one that never starts.
assertProductionConfig();

const app = createApp();

// Eagerly initialize Firebase Cloud Messaging if configured
void initFcm();

// Under PM2 cluster mode, every worker imports this module and would
// otherwise run the dispatch sweep/subscription-scheduler loop in parallel —
// redundant at best, racy at worst (e.g. duplicate subscription charges).
// PM2 sets NODE_APP_INSTANCE per worker; only "0" runs the singleton job.
// In fork mode / local dev the var is unset, so it still runs.
const isPrimaryInstance =
  process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === "0";

const server = app.listen(env.port, "0.0.0.0", () => {
  console.log(`🚀 NexClean API listening on http://0.0.0.0:${env.port}`);
  console.log(`   Health: http://localhost:${env.port}/api/health`);
});

// Initialize Sockets
initSocket(server).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`✗ Socket.IO init failed: ${message}`);
});

// Connect to MongoDB after the server is already listening so the health
// endpoint stays available even if the database is temporarily unreachable.
connectDb()
  .then(() => seedDemoData())
  .then(async () => {
    // Index setup is idempotent, so every instance can run it safely.
    await ensureNotificationRetention();
    // Every instance validates bookings against the slot list, so every
    // instance (not just the primary) loads it and keeps it fresh.
    await refreshSlotCache().catch((err) =>
      console.error("time slot load failed, using defaults:", (err as Error).message),
    );
    startSlotCacheRefresh();
    if (!isPrimaryInstance) return;
    // Recover any in-flight dispatch state, then start the offer/scheduler loop.
    await resumeDispatch().catch((err) =>
      console.error("dispatch resume failed:", (err as Error).message),
    );
    startDispatchWorker();
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`✗ MongoDB connection/seed failed: ${message}`);
    console.error("  Set MONGODB_URI in .env (see .env.example).");
  });

const shutdown = (signal: string) => {
  console.log(`\n${signal} received — shutting down.`);
  stopDispatchWorker();
  stopSlotCacheRefresh();
  // server.close() only calls back once every open connection has ended, and a
  // connected browser holds keep-alive and WebSocket connections open
  // indefinitely. The listener was already closed, so the process sat alive
  // but refusing connections (ERR_CONNECTION_REFUSED) — and `node --watch`,
  // which waits for the old process to exit, never started the new one.
  server.close(() => process.exit(0));
  server.closeAllConnections();
  // Upgraded WebSockets aren't tracked by closeAllConnections; don't wait on them.
  setTimeout(() => process.exit(0), 3_000).unref();
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
