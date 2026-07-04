import { useEffect, useState, useCallback } from "react";
import { tableApi, apiErrorMessage } from "../../api/client.js";
import Alert from "../common/Alert.jsx";
import { Grid, Users, Plus, Power } from "../common/icons.jsx";

/** Admin CRUD for tables (create, edit capacity, enable/disable). */
export default function TableManager() {
  const [tables, setTables] = useState([]);
  const [form, setForm] = useState({ tableNumber: "", capacity: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await tableApi.list();
      setTables(data.tables);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    try {
      await tableApi.create({
        tableNumber: Number(form.tableNumber),
        capacity: Number(form.capacity),
      });
      setForm({ tableNumber: "", capacity: "" });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const toggleActive = async (t) => {
    try {
      if (t.isActive) await tableApi.deactivate(t._id);
      else await tableApi.update(t._id, { isActive: true });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const changeCapacity = async (t, capacity) => {
    try {
      await tableApi.update(t._id, { capacity: Number(capacity) });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">
        <Grid className="icon" size={20} />
        Manage tables
      </h2>
      <Alert message={error} />

      <form onSubmit={create} className="mb-4 flex flex-wrap items-end gap-4">
        <label className="mb-0">
          <span className="inline-flex items-center gap-1.5">
            <Grid size={13} /> Table #
          </span>
          <input
            type="number"
            min={1}
            value={form.tableNumber}
            onChange={(e) => setForm({ ...form, tableNumber: e.target.value })}
            required
          />
        </label>
        <label className="mb-0">
          <span className="inline-flex items-center gap-1.5">
            <Users size={13} /> Capacity
          </span>
          <input
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            required
          />
        </label>
        <button className="btn btn-primary">
          <Plus size={16} />
          Add table
        </button>
      </form>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Table</th>
                <th>Capacity</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tables.map((t) => (
                <tr key={t._id} className={t.isActive ? "" : "opacity-50"}>
                  <td>#{t.tableNumber}</td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      defaultValue={t.capacity}
                      className="w-16"
                      onBlur={(e) => {
                        if (Number(e.target.value) !== t.capacity) changeCapacity(t, e.target.value);
                      }}
                    />
                  </td>
                  <td>
                    <span className={`pill ${t.isActive ? "pill-confirmed" : "pill-cancelled"}`}>
                      {t.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(t)}>
                      <Power size={14} />
                      {t.isActive ? "Disable" : "Enable"}
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
