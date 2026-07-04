import { useEffect, useState, useCallback } from "react";
import { reservationApi, apiErrorMessage } from "../../api/client.js";
import Alert from "../common/Alert.jsx";
import { Clipboard, Check, X, Trash } from "../common/icons.jsx";

export default function MyReservations({ refreshKey }) {
  const [reservations, setReservations] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await reservationApi.mine();
      setReservations(data.reservations);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const cancel = async (id) => {
    try {
      await reservationApi.cancel(id);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">
        <Clipboard className="icon" size={20} />
        My reservations
      </h2>
      <Alert message={error} />
      {loading ? (
        <p className="muted">Loading…</p>
      ) : reservations.length === 0 ? (
        <p className="muted">No reservations yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Slot</th>
                <th>Table</th>
                <th>Guests</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r._id}>
                  <td>{r.date}</td>
                  <td>{r.timeSlot}</td>
                  <td>{r.table ? `#${r.table.tableNumber}` : "—"}</td>
                  <td>{r.guests}</td>
                  <td>
                    <span className={`pill pill-${r.status}`}>
                      {r.status === "cancelled" ? <X size={12} /> : <Check size={12} />}
                      {r.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={r.status === "cancelled"}
                      onClick={() => cancel(r._id)}
                    >
                      <Trash size={14} />
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
