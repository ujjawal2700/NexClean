import mongoose from "mongoose";
import { env } from "./env";

/**
 * Connect to MongoDB Atlas via Mongoose. Called after the HTTP server is
 * already listening so /api/health works even if the database is unreachable.
 */
export async function connectDb(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 8000,
  });
  console.log("✓ MongoDB connected");
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
