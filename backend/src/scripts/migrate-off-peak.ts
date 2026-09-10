/**
 * One-time migration for the peak → off-peak inversion.
 *
 * Run once per environment after deploying the rename:
 *   cd backend && node --import tsx src/scripts/migrate-off-peak.ts
 *
 * Three things need moving, and none of them can be left to a plain rename:
 *
 *  1. ROLE PERMISSIONS. Staff roles store the permission key as a string. A role
 *     holding "peak-hours" would silently lose the screen, with no error
 *     anywhere — it would simply stop appearing in their sidebar.
 *
 *  2. COUPON FLAGS. The old `peakHoursOnly` field meant "only valid in the busy
 *     hours". Carried across as-is it would mean the exact opposite, quietly
 *     redirecting a discount at a different set of customers. The flag is
 *     dropped rather than translated, so an admin re-marks deliberately.
 *
 *  3. THE WINDOWS THEMSELVES are not migrated at all. The new config lives in
 *     its own collection, so the old peak windows stay untouched in
 *     `peakhoursconfigs` (useful for reference) and the admin starts from an
 *     empty off-peak config. Complementing the old windows automatically was
 *     considered and rejected: the complement of "Sunday 08:00–12:00 is busy"
 *     includes 3 a.m., which is not a slot anyone sells and not a decision
 *     anyone made.
 *
 * Safe to run more than once — every step is idempotent.
 */
import mongoose from "mongoose";
import { env } from "../config/env";

async function main(): Promise<void> {
  await mongoose.connect(env.mongoUri);
  const db = mongoose.connection.db;
  if (!db) throw new Error("no database handle after connect");

  console.log(`Connected to ${mongoose.connection.name}`);

  // 1. Roles: "peak-hours" -> "off-peak-hours", preserving order and duplicates-free.
  const roles = db.collection("adminroles");
  const withOldPerm = await roles.find({ permissions: "peak-hours" }).toArray();
  for (const role of withOldPerm) {
    const next = Array.from(
      new Set((role.permissions as string[]).map((p) => (p === "peak-hours" ? "off-peak-hours" : p))),
    );
    await roles.updateOne({ _id: role._id }, { $set: { permissions: next } });
    console.log(`  role "${role.name}" → permission remapped`);
  }
  console.log(`Roles updated: ${withOldPerm.length}`);

  // 2. Coupon flags: drop the old field entirely. `offPeakOnly` defaults to
  //    false, so every previously peak-gated code becomes an ordinary code
  //    until an admin re-marks it.
  const discountRes = await db
    .collection("discountcodes")
    .updateMany({ peakHoursOnly: { $exists: true } }, { $unset: { peakHoursOnly: "" } });
  const couponRes = await db
    .collection("specialcoupons")
    .updateMany({ peakHoursOnly: { $exists: true } }, { $unset: { peakHoursOnly: "" } });
  console.log(`Discount codes cleared: ${discountRes.modifiedCount}`);
  console.log(`Special coupons cleared: ${couponRes.modifiedCount}`);

  // 3. Banner type: the "peak-hours" badge is now "off-peak-hours". Cosmetic,
  //    but an unmapped value would fall back to the generic badge.
  const bannerRes = await db
    .collection("promobanners")
    .updateMany({ type: "peak-hours" }, { $set: { type: "off-peak-hours" } });
  console.log(`Banners retyped: ${bannerRes.modifiedCount}`);

  const oldWindows = await db.collection("peakhoursconfigs").findOne({ _id: "global" as never });
  if (oldWindows) {
    console.log(
      `\nNOTE: the previous peak config is preserved in "peakhoursconfigs" for reference.\n` +
        `      It is NOT copied over — those windows meant "busy", and the new screen means "quiet".\n` +
        `      Set the off-peak windows in Admin → Off-Peak Hours before enabling any off-peak coupon.`,
    );
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
