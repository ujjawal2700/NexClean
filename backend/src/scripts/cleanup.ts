import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { User } from "../modules/user/user.model";
import { Booking } from "../modules/booking/booking.model";
import { Payment } from "../modules/payment/payment.model";
import { Notification } from "../modules/notification/notification.model";
import { WalletTransaction } from "../modules/wallet/walletTransaction.model";
import { SpecialCoupon } from "../modules/promotions/specialCoupon.model";
import { TriggeredAlert } from "../modules/area-alert/areaAlert.model";
import { Lead } from "../modules/lead/lead.model";
import { seedDemoData } from "../config/seed";

async function cleanupData() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI not defined in environment.");
    process.exit(1);
  }

  console.log("🧹 Connecting to database for cleanup...");
  await mongoose.connect(uri);

  console.log("🔥 Clearing customer, cleaner, leads data & logs...");

  // 1. Delete all bookings, payments, notifications, transactions, special coupons, area alerts, leads
  const bRes = await Booking.deleteMany({});
  const pRes = await Payment.deleteMany({});
  const nRes = await Notification.deleteMany({});
  const wtRes = await WalletTransaction.deleteMany({});
  const scRes = await SpecialCoupon.deleteMany({});
  const aRes = await TriggeredAlert.deleteMany({});
  const lRes = await Lead.deleteMany({});

  // 2. Delete all customer & agent users (keep admin intact)
  const uRes = await User.deleteMany({ role: { $in: ["customer", "agent"] } });

  console.log(`✅ Cleanup statistics:
    - ${bRes.deletedCount} Bookings removed
    - ${pRes.deletedCount} Payments removed
    - ${nRes.deletedCount} Notifications removed
    - ${wtRes.deletedCount} Wallet Transactions removed
    - ${scRes.deletedCount} Special Coupons removed
    - ${aRes.deletedCount} Triggered Area Alerts removed
    - ${lRes.deletedCount} Leads removed
    - ${uRes.deletedCount} Customer & Agent Users removed
  `);

  console.log("🌱 Reseeding default demo accounts...");
  await seedDemoData();

  console.log("✨ Cleanup completed successfully! Database is ready for fresh testing.");
  await mongoose.disconnect();
  process.exit(0);
}

cleanupData().catch((err) => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});
