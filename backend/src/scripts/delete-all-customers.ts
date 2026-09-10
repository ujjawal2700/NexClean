import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { User } from "../modules/user/user.model";
import { Booking } from "../modules/booking/booking.model";
import { Payment } from "../modules/payment/payment.model";
import { Notification } from "../modules/notification/notification.model";
import { WalletTransaction } from "../modules/wallet/walletTransaction.model";
import { SpecialCoupon } from "../modules/promotions/specialCoupon.model";
import { SupportTicket } from "../modules/chat/ticket.model";

async function deleteAllCustomers() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI not defined in environment.");
    process.exit(1);
  }

  console.log("🧹 Connecting to database...");
  await mongoose.connect(uri);

  console.log("🔍 Finding all customer accounts...");
  const customers = await User.find({ role: "customer" }).select("_id name phone");
  const customerIds = customers.map((c) => c._id);

  console.log(`Found ${customerIds.length} customer account(s). Deleting associated data...`);

  if (customerIds.length === 0) {
    console.log("ℹ️ No customers found to delete.");
    await mongoose.disconnect();
    process.exit(0);
  }

  // 1. Find all bookings belonging to these customers
  const bookings = await Booking.find({ user: { $in: customerIds } }).select("_id");
  const bookingIds = bookings.map((b) => b._id);

  // 2. Delete payments (either made by customer or linked to customer's bookings)
  const pRes = await Payment.deleteMany({
    $or: [{ user: { $in: customerIds } }, { booking: { $in: bookingIds } }],
  });

  // 3. Delete bookings
  const bRes = await Booking.deleteMany({ user: { $in: customerIds } });

  // 4. Delete wallet transactions, special coupons, support tickets, notifications
  const wtRes = await WalletTransaction.deleteMany({
    $or: [{ user: { $in: customerIds } }, { relatedUser: { $in: customerIds } }],
  });
  const scRes = await SpecialCoupon.deleteMany({
    $or: [{ usedBy: { $in: customerIds } }, { assignedCustomer: { $in: customerIds } }],
  });
  const stRes = await SupportTicket.deleteMany({ user: { $in: customerIds } });
  const nRes = await Notification.deleteMany({ user: { $in: customerIds } });

  // 5. Delete the customer user accounts
  const uRes = await User.deleteMany({ _id: { $in: customerIds }, role: "customer" });

  console.log(`
✅ Successfully deleted all customers and their corresponding data:
   - ${uRes.deletedCount} Customer Accounts removed
   - ${bRes.deletedCount} Bookings removed
   - ${pRes.deletedCount} Payments removed
   - ${wtRes.deletedCount} Wallet Transactions removed
   - ${scRes.deletedCount} Special Coupons removed
   - ${stRes.deletedCount} Support Tickets removed
   - ${nRes.deletedCount} Notifications removed
`);

  await mongoose.disconnect();
  process.exit(0);
}

deleteAllCustomers().catch((err) => {
  console.error("❌ Failed to delete customers:", err);
  process.exit(1);
});
