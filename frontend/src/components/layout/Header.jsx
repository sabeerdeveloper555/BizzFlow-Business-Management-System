import { useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import NAV_ITEMS from "./navItems.js";

/* Compact top bar: opens the mobile drawer, shows the current page context,
   and surfaces the signed-in user on larger screens. Kept intentionally light
   so it never competes with the page content. */
export default function Header({ onMenuClick }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const current = NAV_ITEMS.find((item) => pathname.startsWith(item.to));
  const initials = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/70 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold text-zinc-900">
          {current?.label ?? "BizFlow"}
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="max-w-[12rem] truncate text-sm font-medium text-zinc-900">
            {user?.name || user?.email}
          </p>
          <span className="text-xs capitalize text-zinc-500">{user?.role}</span>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200">
          {initials}
        </span>
      </div>
    </header>
  );
}
