import { createApp } from "./app";
import { connectDb } from "./config/db";
import { seedDemoData } from "./config/seed";
import { env } from "./config/env";

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`🚀 NexClean API listening on http://localhost:${env.port}`);
  console.log(`   Health: http://localhost:${env.port}/api/health`);
});

// Connect to MongoDB after the server is already listening so the health
// endpoint stays available even if the database is temporarily unreachable.
connectDb()
  .then(() => seedDemoData())
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`✗ MongoDB connection/seed failed: ${message}`);
    console.error("  Set MONGODB_URI in .env (see .env.example).");
  });

const shutdown = (signal: string) => {
  console.log(`\n${signal} received — shutting down.`);
  server.close(() => process.exit(0));
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
