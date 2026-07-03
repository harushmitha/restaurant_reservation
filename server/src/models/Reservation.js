import mongoose from "mongoose";
import { TIME_SLOTS } from "../utils/slots.js";

const reservationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: true,
    },
    // Stored as a "YYYY-MM-DD" string for slot equality checks without timezone drift.
    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"],
    },
    timeSlot: {
      type: String,
      required: true,
      enum: TIME_SLOTS,
    },
    guests: {
      type: Number,
      required: true,
      min: [1, "At least one guest is required"],
    },
    status: {
      type: String,
      enum: ["confirmed", "cancelled"],
      default: "confirmed",
    },
  },
  { timestamps: true }
);

/**
 * Concurrency guard: a partial unique index over (table, date, timeSlot) that only
 * applies to CONFIRMED reservations. The database itself rejects a second confirmed
 * booking for the same table+slot, closing the double-booking race even under
 * simultaneous requests. Cancelled rows are excluded, so a freed slot is rebookable.
 */
reservationSchema.index(
  { table: 1, date: 1, timeSlot: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "confirmed" },
    name: "uniq_confirmed_table_slot",
  }
);

export const Reservation = mongoose.model("Reservation", reservationSchema);
