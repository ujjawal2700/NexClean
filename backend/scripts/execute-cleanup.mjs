import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI not found");
  process.exit(1);
}

const client = new MongoClient(uri);

// List of phones of genuine accounts to PRESERVE:
const KEEP_PHONES = [
  "admin:superadmin@gmail.com",
  "admin-staff:sakshi123@gmail.com",
  "8769959424", // Ujjawal (Customer)
  "9772732665", // Sakshi (Agent)
  "6232075318", // Swati Patidar (Agent)
  "7879363299", // Harsh Pandey (Agent)
  "1111122222", // harsh (Agent)
  "9000000001", // Rohit Kumar (Demo Agent)
  "9000000002", // Imran Shaikh (Demo Agent)
  "9000000003", // Sana Khan (Demo Agent)
  "9000000004", // Deepak Yadav (Demo Agent)
];

const COLLECTIONS_TO_CLEAR = [
  "bookings",
  "payments",
  "chatmessages",
  "leads",
  "payoutrequests",
  "triggeredalerts",
  "campaigns",
  "specialcoupons",
];

async function runCleanup() {
  await client.connect();
  const db = client.db();
  console.log(`Connected to database: ${db.databaseName}\n`);

  console.log("=== 1. CLEANING TRANSACTIONAL / TEST COLLECTIONS ===");
  for (const collName of COLLECTIONS_TO_CLEAR) {
    const coll = db.collection(collName);
    const beforeCount = await coll.countDocuments();
    const result = await coll.deleteMany({});
    console.log(`  ✓ ${collName}: deleted ${result.deletedCount} of ${beforeCount} documents.`);
  }

  console.log("\n=== 2. CLEANING TEST USERS ===");
  const usersColl = db.collection("users");
  const totalUsersBefore = await usersColl.countDocuments();
  
  // Delete all users whose phone is NOT in KEEP_PHONES
  const deleteResult = await usersColl.deleteMany({
    phone: { $nin: KEEP_PHONES }
  });
  console.log(`  ✓ users: deleted ${deleteResult.deletedCount} test users.`);

  const remainingUsers = await usersColl.find({}).project({ phone: 1, name: 1, role: 1, email: 1 }).toArray();
  console.log(`\nRemaining genuine accounts (${remainingUsers.length}):`);
  remainingUsers.forEach(u => console.log(`  - [${u.role}] ${u.name} | ${u.phone} | ${u.email || "-"}`));

  console.log("\n=== 3. VERIFYING DATABASE STATS ===");
  const stats = await db.stats();
  console.log(`- Data Size: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- Storage Size: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- Total DB Size: ${((stats.storageSize + stats.indexSize) / 1024 / 1024).toFixed(2)} MB`);

  console.log("\nCleanup successfully completed!");
}

runCleanup()
  .catch(err => console.error("Error during cleanup:", err))
  .finally(() => client.close());
