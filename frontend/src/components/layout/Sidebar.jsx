import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { visibleNav } from "./navItems.js";

/* Left navigation rail. Renders as a fixed full-height column on desktop and
   as a slide-in drawer on mobile (controlled by `open` / `onClose`). Staff is
   shown according to the existing admin-only RBAC rule. */
export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = visibleNav(user?.role);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const initials = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-72 transform flex-col border-r border-zinc-800 bg-zinc-900 text-zinc-300 transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-64 lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
      aria-label="Sidebar"
    >
      {/* Branding */}
      <div className="flex h-16 items-center gap-2.5 border-b border-zinc-800 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="text-lg font-bold tracking-tight text-white">BizFlow</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Primary">
        {items.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                isActive ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`absolute left-0 h-5 w-1 rounded-r-full bg-emerald-400 transition-opacity ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                  aria-hidden="true"
                />
                <Icon
                  className={`h-5 w-5 shrink-0 ${isActive ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-300"}`}
                  aria-hidden="true"
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Account area */}
      <div className="border-t border-zinc-800 p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-sm font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user?.name || user?.email}</p>
            <p className="truncate text-xs capitalize text-zinc-500">{user?.role}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <LogOut className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true" />
          Log out
        </button>
      </div>
    </aside>
  );
}
