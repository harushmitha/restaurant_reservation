import "dotenv/config";
import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 5000;

async function start() {
  if (!process.env.JWT_SECRET) {
    console.error("[fatal] JWT_SECRET is not set. Copy server/.env.example to server/.env.");
    process.exit(1);
  }

  try {
    await connectDB(process.env.MONGODB_URI);

    // Ensure indexes (including the partial unique conflict guard) are built.
    const { Reservation } = await import("./models/Reservation.js");
    await Reservation.syncIndexes();

    const app = createApp();
    app.listen(PORT, () => {
      console.log(`[server] listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("[fatal] failed to start server:", err.message);
    process.exit(1);
  }
}

start();
