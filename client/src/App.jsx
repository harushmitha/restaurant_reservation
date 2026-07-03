import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Navbar from "./components/common/Navbar.jsx";
import ProtectedRoute from "./components/common/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import CustomerDashboard from "./pages/CustomerDashboard.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";

export default function App() {
  const { user } = useAuth();

  // Where "/" and post-auth redirects should land, based on role.
  const home = user ? (user.role === "admin" ? "/admin" : "/dashboard") : "/login";

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={user ? <Navigate to={home} replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to={home} replace /> : <Register />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute role="customer">
              <CustomerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to={home} replace />} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </>
  );
}
