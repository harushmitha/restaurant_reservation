import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

/**
 * Client-side route guard for UX only. `role` optionally restricts to a role.
 * NOTE: this is convenience routing — the backend independently enforces
 * authentication and authorization on every request.
 */
export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="container">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    // Send users to their own dashboard rather than showing a forbidden screen.
    return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  }
  return children;
}
