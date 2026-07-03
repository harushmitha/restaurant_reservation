import { Table } from "../models/Table.js";
import { ApiError } from "../utils/ApiError.js";

/** GET /api/tables — list tables (all authenticated users, for the booking UI). */
export async function listTables(req, res, next) {
  try {
    const tables = await Table.find().sort({ tableNumber: 1 });
    res.json({ success: true, count: tables.length, tables });
  } catch (err) {
    next(err);
  }
}

/** POST /api/tables — admin creates a table. */
export async function createTable(req, res, next) {
  try {
    const { tableNumber, capacity, isActive } = req.body;
    const table = await Table.create({ tableNumber, capacity, isActive });
    res.status(201).json({ success: true, table });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/tables/:id — admin updates capacity / number / active flag. */
export async function updateTable(req, res, next) {
  try {
    const { tableNumber, capacity, isActive } = req.body;
    const update = {};
    if (tableNumber !== undefined) update.tableNumber = tableNumber;
    if (capacity !== undefined) update.capacity = capacity;
    if (isActive !== undefined) update.isActive = isActive;

    const table = await Table.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!table) throw ApiError.notFound("Table not found");

    res.json({ success: true, table });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/tables/:id — admin soft-disables a table (keeps history intact). */
export async function deactivateTable(req, res, next) {
  try {
    const table = await Table.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!table) throw ApiError.notFound("Table not found");

    res.json({ success: true, message: "Table disabled", table });
  } catch (err) {
    next(err);
  }
}
