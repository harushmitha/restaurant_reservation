import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { apiErrorMessage } from "../api/client.js";
import Alert from "../components/common/Alert.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(form.email, form.password);
      navigate(user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container flex justify-center pt-[72px]">
      <div className="card w-full max-w-[400px]">
        <p className="mb-1.5 text-center font-sans text-[11px] font-bold tracking-[4px] text-gold-dark">
          HARSHU'S KITCHEN
        </p>
        <h1 className="mb-6 text-center text-3xl">
          Sign in
          <span className="mx-auto mt-3 block h-0.5 w-11 bg-gold" />
        </h1>
        <Alert message={error} />
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </label>
          <button className="btn btn-primary mt-1 w-full py-3" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="muted mt-4 text-center">
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
