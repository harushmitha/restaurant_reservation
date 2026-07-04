import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { Utensils, LogOut } from "./icons.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="border-b-[3px] border-accent bg-brand shadow-[0_2px_18px_rgba(15,27,21,0.25)]">
      <div className="container flex h-[68px] items-center justify-between">
        <Link
          to={isAdmin ? "/admin" : "/dashboard"}
          className="flex items-center gap-3 font-display text-[22px] font-bold tracking-wide text-white no-underline hover:text-white"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white shadow-sm">
            <Utensils size={19} />
          </span>
          Harshu's Kitchen
          {isAdmin && (
            <span className="rounded bg-accent px-2.5 py-0.5 font-sans text-[10.5px] font-bold uppercase tracking-widest text-white">
              Admin Panel
            </span>
          )}
        </Link>

        {user && (
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-sm text-[#e7ded1]">
              {user.name}
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] uppercase tracking-wider text-white">
                {user.role}
              </span>
            </span>
            <button
              className="btn btn-ghost !border-white/40 !text-white hover:!bg-white/10 hover:!brightness-100"
              onClick={handleLogout}
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
