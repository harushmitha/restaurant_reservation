import mongoose from "mongoose";

const tableSchema = new mongoose.Schema(
  {
    tableNumber: {
      type: Number,
      required: [true, "Table number is required"],
      unique: true,
      min: [1, "Table number must be positive"],
    },
    capacity: {
      type: Number,
      required: [true, "Capacity is required"],
      min: [1, "Capacity must be at least 1"],
    },
    // Soft-disable instead of hard delete so historical reservations stay intact.
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Table = mongoose.model("Table", tableSchema);
