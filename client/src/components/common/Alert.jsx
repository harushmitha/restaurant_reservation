import { AlertTriangle, CheckCircle } from "./icons.jsx";

/** Inline, dismissible-free alert for surfacing errors/success clearly (not raw JSON). */
export default function Alert({ type = "error", message }) {
  if (!message) return null;
  const IconEl = type === "success" ? CheckCircle : AlertTriangle;
  return (
    <div className={`alert alert-${type}`}>
      <IconEl size={17} className="mt-px" />
      <span>{message}</span>
    </div>
  );
}
