import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import ReservationForm from "../components/customer/ReservationForm.jsx";
import MyReservations from "../components/customer/MyReservations.jsx";

export default function CustomerDashboard() {
  const { user } = useAuth();
  // Bumping this key re-fetches "My reservations" after a successful booking.
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="container">
      <h1 className="page-title">Welcome, {user.name}</h1>
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
        <ReservationForm onBooked={() => setRefreshKey((k) => k + 1)} />
        <MyReservations refreshKey={refreshKey} />
      </div>
    </div>
  );
}
