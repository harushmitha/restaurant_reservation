import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="border-b-[3px] border-gold bg-wine shadow-[0_2px_14px_rgba(43,38,32,0.12)]">
      <div className="container flex h-[68px] items-center justify-between">
        <Link
          to={isAdmin ? "/admin" : "/dashboard"}
          className="flex items-center gap-3 font-display text-[22px] font-bold tracking-wide text-white no-underline hover:text-white"
        >
          🍽️ Harshu's Kitchen
          {isAdmin && (
            <span className="rounded bg-gold px-2.5 py-0.5 font-sans text-[10.5px] font-bold uppercase tracking-widest text-ink">
              Admin Panel
            </span>
          )}
        </Link>

        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#f3e7d8]">
              {user.name}
              <span className="ml-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] uppercase tracking-wider text-white">
                {user.role}
              </span>
            </span>
            <button
              className="btn btn-ghost !border-white/55 !text-white hover:!bg-white/10 hover:!brightness-100"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
