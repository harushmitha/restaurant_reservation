import { useState } from "react";
import AllReservations from "../components/admin/AllReservations.jsx";
import TableManager from "../components/admin/TableManager.jsx";
import { Clipboard, Grid } from "../components/common/icons.jsx";

export default function AdminDashboard() {
  const [tab, setTab] = useState("reservations");

  const tabClass = (name) =>
    `-mb-px flex cursor-pointer items-center gap-2 border-b-[3px] px-1.5 py-2.5 font-sans text-sm font-bold tracking-wide transition ${
      tab === name
        ? "border-accent text-accent-dark"
        : "border-transparent text-ink-soft hover:text-ink"
    }`;

  return (
    <div className="container">
      <p className="mt-9 kicker">
        <Grid size={13} /> Restaurant control
      </p>
      <h1 className="page-title !mt-2">
        <Clipboard size={26} />
        Admin Panel
        <span className="rounded bg-accent px-2.5 py-0.5 font-sans text-[10.5px] font-bold uppercase tracking-widest text-white">
          Admin
        </span>
      </h1>

      <div className="mb-5 mt-5 flex gap-2.5 border-b border-line">
        <button className={tabClass("reservations")} onClick={() => setTab("reservations")}>
          <Clipboard size={16} />
          Reservations
        </button>
        <button className={tabClass("tables")} onClick={() => setTab("tables")}>
          <Grid size={16} />
          Tables
        </button>
      </div>

      {tab === "reservations" ? <AllReservations /> : <TableManager />}
    </div>
  );
}
