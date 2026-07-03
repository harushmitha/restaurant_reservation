import mongoose from "mongoose";

/**
 * Establish the MongoDB connection. Fails fast (exits the process) if the
 * connection cannot be established at boot — a running DB is a hard dependency.
 */
export async function connectDB(uri) {
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy .env.example to .env.");
  }

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(uri, {
      // Fail quickly instead of hanging for 30s if the DB is unreachable.
      serverSelectionTimeoutMS: 8000,
    });
    console.log("[db] connected to MongoDB");
  } catch (err) {
    console.error("[db] connection error:", err.message);
    throw err;
  }

  mongoose.connection.on("error", (err) => {
    console.error("[db] runtime error:", err.message);
  });

  return mongoose.connection;
}
