import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import tableRoutes from "./routes/tableRoutes.js";
import reservationRoutes from "./routes/reservationRoutes.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  // Restrict CORS to the configured frontend origin(s).
  const origins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim());
  app.use(cors({ origin: origins, credentials: true }));

  app.use(express.json());

  // Health check for uptime probes / deployment smoke tests.
  app.get("/api/health", (req, res) => {
    res.json({ success: true, status: "ok", time: new Date().toISOString() });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/tables", tableRoutes);
  app.use("/api/reservations", reservationRoutes);

  // 404 + centralized error handler (must be last).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
