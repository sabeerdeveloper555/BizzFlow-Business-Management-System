import { LayoutDashboard, Users, Package, ShoppingCart, UserCog } from "lucide-react";

/* Single source of truth for primary navigation. Icons come from Lucide.
   Staff is gated behind the existing admin-only RBAC rule in the sidebar. */
const NAV_ITEMS = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Customers", to: "/customers", icon: Users },
  { label: "Products", to: "/products", icon: Package },
  { label: "Orders", to: "/orders", icon: ShoppingCart },
  { label: "Staff", to: "/staff", icon: UserCog, adminOnly: true },
];

export default NAV_ITEMS;

export function visibleNav(role) {
  return NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");
}
