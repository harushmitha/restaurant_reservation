/** Inline, dismissible-free alert for surfacing errors/success clearly (not raw JSON). */
export default function Alert({ type = "error", message }) {
  if (!message) return null;
  return <div className={`alert alert-${type}`}>{message}</div>;
}
