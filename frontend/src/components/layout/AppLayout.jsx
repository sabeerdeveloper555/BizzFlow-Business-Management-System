import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

const links = [
  ["Dashboard", "/dashboard"],
  ["Customers", "/customers"],
  ["Products", "/products"],
  ["Orders", "/orders"],
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-5 px-5 py-4">
          <NavLink
            to="/dashboard"
            className="mr-auto text-lg font-bold tracking-tight"
          >
            BizFlow
          </NavLink>
          <nav className="flex flex-wrap gap-1" aria-label="Main navigation">
            {links.map(([label, path]) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  `rounded px-3 py-2 text-sm ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`
                }
              >
                {label}
              </NavLink>
            ))}
            {user?.role === "admin" && (
              <NavLink
                to="/staff"
                className={({ isActive }) =>
                  `rounded px-3 py-2 text-sm ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`
                }
              >
                Staff
              </NavLink>
            )}
          </nav>
          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden text-right sm:block">
                <p className="text-xs font-medium text-slate-900">{user.name || user.email}</p>
                <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                  {user.role}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <LogOut size={16} /> Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}
