#!/usr/bin/env node
// One-time cleanup: clears transactional/test data from the production
// Atlas cluster while preserving everything the app needs to keep running
// (catalog/pricing config, the one real admin login).
//
// Usage:
//   node backend/scripts/wipe-test-data.mjs           # dry run — counts only
//   node backend/scripts/wipe-test-data.mjs --confirm # actually deletes
//
// Scope (confirmed 2026-09-12):
//   DELETE: bookings, payments, notifications, chatmessages, triggeredalerts,
//           payoutrequests, leads, campaigns, specialcoupons, and every user
//           whose role isn't "admin" (117 customers + 28 agents at last count).
//   DELETE (admin cleanup): every admin user EXCEPT the one matching
//           KEEP_ADMIN_PHONE below — 4 duplicate/test admin records
//           ("Smoke Admin", a stray "admin-staff:sakshi123@gmail.com", and
//           two duplicate superadmin phone variants).
//   KEEP:   cities, servicezones, and every config collection (plans,
//           pricings, vehiclebrands/categories/models, payoutconfigs,
//           peakhoursconfigs, offpeakhoursconfigs, referralconfigs,
//           rescheduleconfigs, sitecontents, supportconfigs,
//           areaalertsettings, adminroles, discountcodes).

import { MongoClient } from "mongodb";
import "dotenv/config";

const WIPE_COLLECTIONS = [
  "bookings", "payments", "notifications", "chatmessages",
  "triggeredalerts", "payoutrequests", "leads", "campaigns", "specialcoupons",
];
// The one admin record that matches ADMIN_EMAIL in .env — the account
// adminLogin() actually authenticates against (phone: `admin:${email}`).
const KEEP_ADMIN_PHONE = `admin:${(process.env.ADMIN_EMAIL ?? "superadmin@gmail.com").toLowerCase()}`;

const confirm = process.argv.includes("--confirm");

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db();

console.log(confirm ? "=== EXECUTING (--confirm passed) ===" : "=== DRY RUN (pass --confirm to actually delete) ===");
console.log(`Keeping admin: ${KEEP_ADMIN_PHONE}\n`);

for (const name of WIPE_COLLECTIONS) {
  const n = await db.collection(name).countDocuments();
  if (confirm) {
    const res = await db.collection(name).deleteMany({});
    console.log(`  ${name}: deleted ${res.deletedCount}`);
  } else {
    console.log(`  ${name}: ${n} document(s) would be deleted`);
  }
}

const nonAdminCount = await db.collection("users").countDocuments({ role: { $ne: "admin" } });
if (confirm) {
  const res = await db.collection("users").deleteMany({ role: { $ne: "admin" } });
  console.log(`  users (non-admin): deleted ${res.deletedCount}`);
} else {
  console.log(`  users (non-admin, customer+agent): ${nonAdminCount} document(s) would be deleted`);
}

const adminDupCount = await db.collection("users").countDocuments({ role: "admin", phone: { $ne: KEEP_ADMIN_PHONE } });
if (confirm) {
  const res = await db.collection("users").deleteMany({ role: "admin", phone: { $ne: KEEP_ADMIN_PHONE } });
  console.log(`  users (admin duplicates): deleted ${res.deletedCount}`);
} else {
  console.log(`  users (admin duplicates to remove): ${adminDupCount} document(s) would be deleted`);
}

await client.close();
console.log(confirm ? "\nDone." : "\nNothing was deleted — re-run with --confirm to execute.");
