import { useState } from "react";
import AllReservations from "../components/admin/AllReservations.jsx";
import TableManager from "../components/admin/TableManager.jsx";

export default function AdminDashboard() {
  const [tab, setTab] = useState("reservations");

  const tabClass = (name) =>
    `-mb-px cursor-pointer border-b-[3px] px-1.5 py-2.5 font-sans text-sm font-bold tracking-wide transition ${
      tab === name
        ? "border-gold text-wine-dark"
        : "border-transparent text-ink-soft hover:text-ink"
    }`;

  return (
    <div className="container">
      <h1 className="page-title">
        Admin Panel
        <span className="rounded bg-gold px-2.5 py-0.5 font-sans text-[10.5px] font-bold uppercase tracking-widest text-ink">
          Admin
        </span>
      </h1>

      <div className="mb-5 mt-5 flex gap-2.5 border-b border-line">
        <button className={tabClass("reservations")} onClick={() => setTab("reservations")}>
          Reservations
        </button>
        <button className={tabClass("tables")} onClick={() => setTab("tables")}>
          Tables
        </button>
      </div>

      {tab === "reservations" ? <AllReservations /> : <TableManager />}
    </div>
  );
}
