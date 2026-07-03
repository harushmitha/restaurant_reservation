import { useState } from "react";
import { reservationApi, apiErrorMessage } from "../../api/client.js";
import { TIME_SLOTS, todayStr } from "../../constants.js";
import Alert from "../common/Alert.jsx";

/**
 * Two-step booking: (1) check availability for date/slot/guests, (2) confirm a
 * table (auto-assign or a specific available table). Conflicts (409) surface as
 * friendly text, never raw JSON.
 */
export default function ReservationForm({ onBooked }) {
  const [form, setForm] = useState({ date: todayStr(), timeSlot: TIME_SLOTS[7], guests: 2 });
  const [available, setAvailable] = useState(null); // null = not checked yet
  const [selectedTable, setSelectedTable] = useState(""); // "" => auto-assign
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setAvailable(null); // any input change invalidates a prior availability check
    setSelectedTable("");
    setSuccess("");
  };

  const checkAvailability = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const { data } = await reservationApi.availability({
        date: form.date,
        timeSlot: form.timeSlot,
        guests: Number(form.guests),
      });
      setAvailable(data.availableTables);
    } catch (err) {
      setError(apiErrorMessage(err));
      setAvailable(null);
    } finally {
      setBusy(false);
    }
  };

  const book = async () => {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const payload = {
        date: form.date,
        timeSlot: form.timeSlot,
        guests: Number(form.guests),
      };
      if (selectedTable) payload.tableId = selectedTable;
      const { data } = await reservationApi.create(payload);
      setSuccess(
        `Reserved Table ${data.reservation.table.tableNumber} for ${form.timeSlot} on ${form.date}.`
      );
      setAvailable(null);
      setSelectedTable("");
      onBooked?.();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">New reservation</h2>
      <Alert message={error} />
      <Alert type="success" message={success} />

      <form onSubmit={checkAvailability} className="flex flex-wrap items-end gap-4">
        <label className="mb-0 min-w-[140px] flex-1">
          Date
          <input
            type="date"
            min={todayStr()}
            value={form.date}
            onChange={(e) => update({ date: e.target.value })}
            required
          />
        </label>
        <label className="mb-0 min-w-[140px] flex-1">
          Time slot
          <select value={form.timeSlot} onChange={(e) => update({ timeSlot: e.target.value })}>
            {TIME_SLOTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="mb-0 min-w-[140px] flex-1">
          Guests
          <input
            type="number"
            min={1}
            value={form.guests}
            onChange={(e) => update({ guests: e.target.value })}
            required
          />
        </label>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Checking…" : "Check availability"}
        </button>
      </form>

      {available !== null && (
        <div className="mt-5 border-t border-dashed border-line-strong pt-5">
          {available.length === 0 ? (
            <p className="muted">No tables available for this slot. Try another time or date.</p>
          ) : (
            <>
              <label className="max-w-[320px]">
                Table
                <select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)}>
                  <option value="">Auto-assign best fit</option>
                  {available.map((t) => (
                    <option key={t._id} value={t._id}>
                      Table {t.tableNumber} (seats {t.capacity})
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn btn-primary" onClick={book} disabled={busy}>
                {busy ? "Booking…" : "Confirm reservation"}
              </button>
              <p className="muted mt-2">{available.length} table(s) available.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
