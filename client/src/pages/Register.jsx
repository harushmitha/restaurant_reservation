import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { apiErrorMessage } from "../api/client.js";
import Alert from "../components/common/Alert.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // Backend always assigns role=customer; there is no way to self-register as admin.
      await register(form.name, form.email, form.password);
      navigate("/dashboard");
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
          Create account
          <span className="mx-auto mt-3 block h-0.5 w-11 bg-gold" />
        </h1>
        <Alert message={error} />
        <form onSubmit={submit}>
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
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
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <small className="muted normal-case">At least 8 characters.</small>
          </label>
          <button className="btn btn-primary mt-1 w-full py-3" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="muted mt-4 text-center">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
