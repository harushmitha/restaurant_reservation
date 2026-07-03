import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { User } from "./models/User.js";
import { Table } from "./models/Table.js";
import { Reservation } from "./models/Reservation.js";

/**
 * Idempotent seed: bootstraps an admin user and a fixed set of tables of varying
 * capacity. Safe to re-run — it upserts rather than duplicating.
 *
 * Admin credentials come from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in .env so
 * no credentials are hardcoded in the repo.
 */
const TABLES = [
  { tableNumber: 1, capacity: 2 },
  { tableNumber: 2, capacity: 2 },
  { tableNumber: 3, capacity: 4 },
  { tableNumber: 4, capacity: 4 },
  { tableNumber: 5, capacity: 6 },
  { tableNumber: 6, capacity: 6 },
  { tableNumber: 7, capacity: 8 },
  { tableNumber: 8, capacity: 10 },
];

async function seed() {
  await connectDB(process.env.MONGODB_URI);
  await Reservation.syncIndexes();

  // ----- Admin user -----
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@restaurant.test").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";

  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      name: "Restaurant Admin",
      email: adminEmail,
      password: adminPassword, // hashed by the User pre-save hook
      role: "admin",
    });
    console.log(`[seed] created admin: ${adminEmail}`);
  } else {
    if (admin.role !== "admin") {
      admin.role = "admin";
      await admin.save();
    }
    console.log(`[seed] admin already exists: ${adminEmail}`);
  }

  // ----- Demo customer -----
  const customerEmail = "customer@restaurant.test";
  let customer = await User.findOne({ email: customerEmail });
  if (!customer) {
    customer = await User.create({
      name: "Demo Customer",
      email: customerEmail,
      password: "Customer@123",
      role: "customer",
    });
    console.log(`[seed] created demo customer: ${customerEmail} / Customer@123`);
  }

  // ----- Tables (upsert by tableNumber) -----
  for (const t of TABLES) {
    await Table.updateOne(
      { tableNumber: t.tableNumber },
      { $set: { capacity: t.capacity, isActive: true } },
      { upsert: true }
    );
  }
  console.log(`[seed] ensured ${TABLES.length} tables`);

  console.log("\n[seed] done. Login as:");
  console.log(`  admin    -> ${adminEmail} / ${adminPassword}`);
  console.log(`  customer -> ${customerEmail} / Customer@123`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error("[seed] failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
