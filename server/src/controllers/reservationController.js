import { Reservation } from "../models/Reservation.js";
import { Table } from "../models/Table.js";
import { ApiError } from "../utils/ApiError.js";
import { isValidSlot, isValidDateString, isPastDate } from "../utils/slots.js";

/**
 * Given a date+slot, return the set of table ids that already hold a CONFIRMED
 * reservation (i.e. are unavailable). Cancelled reservations are excluded, so a
 * cancelled slot is immediately rebookable.
 */
async function bookedTableIds(date, timeSlot) {
  const rows = await Reservation.find({
    date,
    timeSlot,
    status: "confirmed",
  }).select("table");
  return new Set(rows.map((r) => r.table.toString()));
}

/**
 * GET /api/reservations/availability?date=&timeSlot=&guests=
 * Tables that are active, seat the party, and have no confirmed booking for the slot.
 */
export async function getAvailability(req, res, next) {
  try {
    const { date, timeSlot } = req.query;
    const guests = Number(req.query.guests);

    if (!isValidDateString(date)) {
      throw ApiError.badRequest("date must be a valid YYYY-MM-DD value");
    }
    if (isPastDate(date)) {
      throw ApiError.badRequest("Cannot check availability for a past date");
    }
    if (!isValidSlot(timeSlot)) {
      throw ApiError.badRequest("Invalid or missing timeSlot");
    }
    if (!Number.isInteger(guests) || guests < 1) {
      throw ApiError.badRequest("guests must be a positive integer");
    }

    const candidates = await Table.find({
      isActive: true,
      capacity: { $gte: guests },
    }).sort({ capacity: 1, tableNumber: 1 });

    const taken = await bookedTableIds(date, timeSlot);
    const available = candidates.filter((t) => !taken.has(t._id.toString()));

    res.json({
      success: true,
      date,
      timeSlot,
      guests,
      count: available.length,
      availableTables: available,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/reservations   (customer)
 * Body: { date, timeSlot, guests, tableId? }
 *
 * Algorithm (see README §4):
 *  1. Validate input.
 *  2. If tableId given -> verify it's active, seats the party, and is free for the slot.
 *  3. Else auto-assign the smallest-capacity table that fits (best-fit).
 *  4. Insert. The partial unique index is the authoritative double-booking guard:
 *     a concurrent duplicate raises E11000, which we translate to a 409.
 */
export async function createReservation(req, res, next) {
  try {
    const { date, timeSlot, guests, tableId } = req.body;

    if (!isValidDateString(date)) {
      throw ApiError.badRequest("date must be a valid YYYY-MM-DD value");
    }
    if (isPastDate(date)) {
      throw ApiError.badRequest("Cannot create a reservation for a past date");
    }
    if (!isValidSlot(timeSlot)) {
      throw ApiError.badRequest("Invalid or missing timeSlot");
    }
    const guestCount = Number(guests);
    if (!Number.isInteger(guestCount) || guestCount < 1) {
      throw ApiError.badRequest("guests must be a positive integer");
    }

    const taken = await bookedTableIds(date, timeSlot);
    let chosenTable;

    if (tableId) {
      // Preferred-table path: check only that table, never silently substitute.
      const table = await Table.findById(tableId);
      if (!table || !table.isActive) {
        throw ApiError.notFound("Requested table not found or inactive");
      }
      if (table.capacity < guestCount) {
        throw ApiError.badRequest(
          `Table ${table.tableNumber} seats ${table.capacity}, which is fewer than ${guestCount} guests`
        );
      }
      if (taken.has(table._id.toString())) {
        throw ApiError.conflict(
          "This table is already booked for the selected date and time slot"
        );
      }
      chosenTable = table;
    } else {
      // Auto-assign: smallest capacity that fits, to avoid wasting large tables.
      const candidates = await Table.find({
        isActive: true,
        capacity: { $gte: guestCount },
      }).sort({ capacity: 1, tableNumber: 1 });

      chosenTable = candidates.find((t) => !taken.has(t._id.toString()));
      if (!chosenTable) {
        const anyBigEnough = candidates.length > 0;
        throw ApiError.conflict(
          anyBigEnough
            ? "No tables available for this date and time slot"
            : `No active table can seat ${guestCount} guests`
        );
      }
    }

    let reservation;
    try {
      reservation = await Reservation.create({
        user: req.user._id,
        table: chosenTable._id,
        date,
        timeSlot,
        guests: guestCount,
        status: "confirmed",
      });
    } catch (err) {
      // Lost the race between the availability check and the insert: the DB's
      // partial unique index rejected the duplicate. Present it as a clean 409.
      if (err.code === 11000) {
        throw ApiError.conflict(
          "This table was just booked for the selected date and time slot"
        );
      }
      throw err;
    }

    await reservation.populate("table");
    res.status(201).json({ success: true, reservation });
  } catch (err) {
    next(err);
  }
}

/** GET /api/reservations/my  (customer) — the caller's own reservations. */
export async function myReservations(req, res, next) {
  try {
    const reservations = await Reservation.find({ user: req.user._id })
      .populate("table")
      .sort({ date: -1, timeSlot: 1 });
    res.json({ success: true, count: reservations.length, reservations });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/reservations/:id/cancel
 * Customer may cancel only their own confirmed reservation; admin may cancel any.
 */
export async function cancelReservation(req, res, next) {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) throw ApiError.notFound("Reservation not found");

    const isOwner = reservation.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      // 404 (not 403) so a customer can't probe for others' reservation ids.
      throw ApiError.notFound("Reservation not found");
    }

    if (reservation.status === "cancelled") {
      throw ApiError.badRequest("Reservation is already cancelled");
    }

    reservation.status = "cancelled";
    await reservation.save();
    await reservation.populate("table");

    res.json({ success: true, reservation });
  } catch (err) {
    next(err);
  }
}

/* ------------------------------ Admin-only ------------------------------ */

/** GET /api/reservations?date=YYYY-MM-DD&status=  (admin) — all, optionally filtered. */
export async function listAllReservations(req, res, next) {
  try {
    const { date, status } = req.query;
    const filter = {};
    if (date) {
      if (!isValidDateString(date)) {
        throw ApiError.badRequest("date filter must be YYYY-MM-DD");
      }
      filter.date = date;
    }
    if (status) {
      if (!["confirmed", "cancelled"].includes(status)) {
        throw ApiError.badRequest("status filter must be confirmed or cancelled");
      }
      filter.status = status;
    }

    const reservations = await Reservation.find(filter)
      .populate("table")
      .populate("user", "name email role")
      .sort({ date: -1, timeSlot: 1 });

    res.json({ success: true, count: reservations.length, reservations });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/reservations/:id  (admin)
 * Update date/timeSlot/table/guests/status. Re-validates availability if the
 * (table, date, slot) changes so an admin edit can't create a double booking.
 */
export async function updateReservation(req, res, next) {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) throw ApiError.notFound("Reservation not found");

    const { date, timeSlot, guests, tableId, status } = req.body;

    if (date !== undefined) {
      if (!isValidDateString(date)) throw ApiError.badRequest("date must be YYYY-MM-DD");
      reservation.date = date;
    }
    if (timeSlot !== undefined) {
      if (!isValidSlot(timeSlot)) throw ApiError.badRequest("Invalid timeSlot");
      reservation.timeSlot = timeSlot;
    }
    if (guests !== undefined) {
      const g = Number(guests);
      if (!Number.isInteger(g) || g < 1) throw ApiError.badRequest("guests must be positive");
      reservation.guests = g;
    }
    if (tableId !== undefined) {
      const table = await Table.findById(tableId);
      if (!table) throw ApiError.notFound("Table not found");
      reservation.table = table._id;
    }
    if (status !== undefined) {
      if (!["confirmed", "cancelled"].includes(status)) {
        throw ApiError.badRequest("status must be confirmed or cancelled");
      }
      reservation.status = status;
    }

    // If it will remain confirmed, ensure the target table can seat the party
    // and isn't already taken by a *different* confirmed reservation.
    if (reservation.status === "confirmed") {
      const table = await Table.findById(reservation.table);
      if (!table || !table.isActive) {
        throw ApiError.badRequest("Target table is inactive or missing");
      }
      if (table.capacity < reservation.guests) {
        throw ApiError.badRequest(
          `Table ${table.tableNumber} seats ${table.capacity}, fewer than ${reservation.guests} guests`
        );
      }
      const clash = await Reservation.findOne({
        _id: { $ne: reservation._id },
        table: reservation.table,
        date: reservation.date,
        timeSlot: reservation.timeSlot,
        status: "confirmed",
      });
      if (clash) {
        throw ApiError.conflict(
          "That table is already booked for the selected date and time slot"
        );
      }
    }

    try {
      await reservation.save();
    } catch (err) {
      if (err.code === 11000) {
        throw ApiError.conflict(
          "That table is already booked for the selected date and time slot"
        );
      }
      throw err;
    }

    await reservation.populate("table");
    await reservation.populate("user", "name email role");
    res.json({ success: true, reservation });
  } catch (err) {
    next(err);
  }
}
