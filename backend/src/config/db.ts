import mongoose from "mongoose";
import { env } from "./env";

/**
 * Connect to MongoDB Atlas via Mongoose. Called after the HTTP server is
 * already listening so /api/health works even if the database is unreachable.
 */
export async function connectDb(retries = 5, delayMs = 5000): Promise<void> {
  mongoose.set("strictQuery", true);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(env.mongoUri, {
        serverSelectionTimeoutMS: 8000,
      });
      console.log("✓ MongoDB connected");
      await dropStaleIndexes();
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ MongoDB connection attempt ${attempt}/${retries} failed: ${message}`);
      if (attempt === retries) {
        throw error;
      }
      console.log(`Retrying in ${delayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
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
  // users.referralCode was a `sparse` unique index, which still indexes the
  // explicit nulls written by the field's `default: null` — so a second
  // code-less user hit a duplicate-key error. It is replaced by the partial
  // index `referralCode_unique` declared on the schema; drop the old name so
  // existing deployments migrate on the next boot.
  try {
    await mongoose.connection.db?.collection("users").dropIndex("referralCode_1");
  } catch {
    // already dropped, or never existed — nothing to do
  }
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
