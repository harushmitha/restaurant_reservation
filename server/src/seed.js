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
  // Credentials must come from the environment — no defaults are baked into the
  // repo so that no real password is ever committed to git history.
  const adminEmail = requireEnv("SEED_ADMIN_EMAIL").toLowerCase();
  const adminPassword = requireEnv("SEED_ADMIN_PASSWORD");

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

  // ----- Demo customer (optional) -----
  // Only seeded when both env vars are supplied; skipped otherwise.
  const customerEmail = process.env.SEED_CUSTOMER_EMAIL?.toLowerCase();
  const customerPassword = process.env.SEED_CUSTOMER_PASSWORD;
  if (customerEmail && customerPassword) {
    const customer = await User.findOne({ email: customerEmail });
    if (!customer) {
      await User.create({
        name: "Demo Customer",
        email: customerEmail,
        password: customerPassword, // hashed by the User pre-save hook
        role: "customer",
      });
      console.log(`[seed] created demo customer: ${customerEmail}`);
    }
  } else {
    console.log("[seed] SEED_CUSTOMER_* not set — skipping demo customer");
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

  // Never log passwords — only the emails that were provisioned.
  console.log("\n[seed] done. Provisioned admin:", adminEmail);
  if (customerEmail && customerPassword) {
    console.log("[seed] provisioned customer:", customerEmail);
  }

  await mongoose.disconnect();
  process.exit(0);
}

/** Read a required env var or fail loudly — avoids silently seeding a default password. */
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(
      `[seed] ${name} is not set. Define it in server/.env (see server/.env.example) ` +
        `before running the seed script.`
    );
    process.exit(1);
  }
  return value;
}

seed().catch(async (err) => {
  console.error("[seed] failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
