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
  await dropStaleIndexes();
}

/**
 * Drop indexes left over from earlier schema versions. Mongoose only adds
 * new indexes on startup — it never removes ones that no longer match the
 * current schema — so a stale index can silently break inserts after a
 * field's uniqueness scope changes. VehicleBrand briefly scoped `name`
 * uniqueness to (name, vehicleType) before settling back on a single
 * brand catalog (with category living on VehicleModel instead) — that
 * transitional compound index needs to go.
 */
async function dropStaleIndexes(): Promise<void> {
  try {
    await mongoose.connection.db?.collection("vehiclebrands").dropIndex("name_1_vehicleType_1");
  } catch {
    // already dropped, or never existed — nothing to do
  }
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
