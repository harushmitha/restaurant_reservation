import { useEffect, useState, useCallback } from "react";
import { reservationApi, apiErrorMessage } from "../../api/client.js";
import { TIME_SLOTS } from "../../constants.js";
import Alert from "../common/Alert.jsx";
import { Clipboard, Calendar, Filter, Check, X, Pencil, Trash } from "../common/icons.jsx";

/** Admin view: every reservation, filterable by date/status, with inline edit + cancel. */
export default function AllReservations() {
  const [reservations, setReservations] = useState([]);
  const [filters, setFilters] = useState({ date: "", status: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // reservation being edited
  const [draft, setDraft] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.date) params.date = filters.date;
      if (filters.status) params.status = filters.status;
      const { data } = await reservationApi.listAll(params);
      setReservations(data.reservations);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async (id) => {
    try {
      await reservationApi.cancel(id);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const startEdit = (r) => {
    setEditing(r._id);
    setDraft({ date: r.date, timeSlot: r.timeSlot, guests: r.guests, status: r.status });
    setError("");
  };

  const saveEdit = async (id) => {
    try {
      await reservationApi.update(id, {
        date: draft.date,
        timeSlot: draft.timeSlot,
        guests: Number(draft.guests),
        status: draft.status,
      });
      setEditing(null);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">
        <Clipboard className="icon" size={20} />
        All reservations
      </h2>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="mb-0">
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={13} /> Date
          </span>
          <input
            type="date"
            value={filters.date}
            onChange={(e) => setFilters({ ...filters, date: e.target.value })}
          />
        </label>
        <label className="mb-0">
          <span className="inline-flex items-center gap-1.5">
            <Filter size={13} /> Status
          </span>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <button className="btn btn-ghost" onClick={() => setFilters({ date: "", status: "" })}>
          <X size={15} />
          Clear
        </button>
      </div>

      <Alert message={error} />

      {loading ? (
        <p className="muted">Loading…</p>
      ) : reservations.length === 0 ? (
        <p className="muted">No reservations match.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Date</th>
                <th>Slot</th>
                <th>Table</th>
                <th>Guests</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) =>
                editing === r._id ? (
                  <tr key={r._id} className="[&>td]:bg-[#f4efe0]">
                    <td>{r.user?.name || "—"}</td>
                    <td>
                      <input
                        type="date"
                        value={draft.date}
                        onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        value={draft.timeSlot}
                        onChange={(e) => setDraft({ ...draft, timeSlot: e.target.value })}
                      >
                        {TIME_SLOTS.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td>{r.table ? `#${r.table.tableNumber}` : "—"}</td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        value={draft.guests}
                        onChange={(e) => setDraft({ ...draft, guests: e.target.value })}
                        className="w-16"
                      />
                    </td>
                    <td>
                      <select
                        value={draft.status}
                        onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                      >
                        <option value="confirmed">confirmed</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-primary btn-sm" onClick={() => saveEdit(r._id)}>
                          <Check size={14} />
                          Save
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                          <X size={14} />
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={r._id}>
                    <td>
                      {r.user?.name || "—"}
                      <br />
                      <small className="muted normal-case">{r.user?.email}</small>
                    </td>
                    <td>{r.date}</td>
                    <td>{r.timeSlot}</td>
                    <td>{r.table ? `#${r.table.tableNumber} (${r.table.capacity})` : "—"}</td>
                    <td>{r.guests}</td>
                    <td>
                      <span className={`pill pill-${r.status}`}>
                        {r.status === "cancelled" ? <X size={12} /> : <Check size={12} />}
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(r)}>
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={r.status === "cancelled"}
                          onClick={() => cancel(r._id)}
                        >
                          <Trash size={14} />
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
