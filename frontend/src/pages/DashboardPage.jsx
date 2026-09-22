import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Users,
  Package,
  ShoppingCart,
  DollarSign,
  UserCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  BarChart3,
  Boxes,
} from "lucide-react";
import { getDashboardMetrics } from "../services/dashboard/dashboardService.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null || isNaN(n)) return "0";
  return Number(n).toLocaleString();
}

function fmtCurrency(n) {
  if (n == null || isNaN(n)) return "Rs. 0";
  return `Rs. ${Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    icon: Clock,
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-400",
    bar: "bg-amber-400",
  },
  processing: {
    label: "Processing",
    icon: Loader2,
    badge: "bg-zinc-100 text-zinc-700 border-zinc-200",
    dot: "bg-zinc-400",
    bar: "bg-zinc-400",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    badge: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-400",
    bar: "bg-red-400",
  },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    badge: "bg-zinc-100 text-zinc-600 border-zinc-200",
    dot: "bg-zinc-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium capitalize ${cfg.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
      {children}
    </h2>
  );
}

function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, iconClass = "text-zinc-500" }) {
  return (
    <Card className="flex items-start gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-100">
        <Icon className={`h-5 w-5 ${iconClass}`} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-zinc-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-zinc-900">
          {value}
        </p>
        {sub && (
          <p className="mt-0.5 truncate text-xs text-zinc-400">{sub}</p>
        )}
      </div>
    </Card>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getDashboardMetrics();
      setData(response.data);
    } catch (err) {
      setError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center gap-2.5 py-20 text-sm text-zinc-500"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span>Loading dashboard…</span>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mt-4 font-medium text-zinc-900">Unable to load dashboard</p>
        <p className="mt-1 text-sm text-zinc-500">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-5 inline-flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  const {
    summary = {},
    orderStatistics = {},
    inventoryStatistics = {},
    customerStatistics = {},
    recentOrders = [],
    lowStockProducts = [],
    topProducts = [],
  } = data ?? {};

  const {
    totalCustomers = 0,
    totalProducts = 0,
    totalOrders = 0,
    totalStaff = 0,
    totalRevenue = 0,
  } = summary;

  const {
    activeProducts = 0,
    inactiveProducts = 0,
    lowStockProducts: lowStockCount = 0,
    outOfStockProducts = 0,
  } = inventoryStatistics;

  const { activeCustomers = 0, inactiveCustomers = 0 } = customerStatistics;

  // Order status bar calc
  const orderStatusTotal = Object.values(orderStatistics).reduce(
    (s, v) => s + (v || 0),
    0,
  );

  return (
    <div className="space-y-8">
      {/* ── Page title ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Business overview and key metrics
        </p>
      </div>

      {/* ── Summary metrics ── */}
      <section aria-labelledby="summary-heading">
        <SectionTitle id="summary-heading">Summary</SectionTitle>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            icon={DollarSign}
            label="Total Revenue"
            value={fmtCurrency(totalRevenue)}
            sub="From completed orders"
            iconClass="text-emerald-600"
          />
          <MetricCard
            icon={ShoppingCart}
            label="Total Orders"
            value={fmt(totalOrders)}
            sub={`${fmt(orderStatistics.completed ?? 0)} completed`}
          />
          <MetricCard
            icon={Users}
            label="Total Customers"
            value={fmt(totalCustomers)}
            sub={`${fmt(activeCustomers)} active`}
          />
          <MetricCard
            icon={Package}
            label="Total Products"
            value={fmt(totalProducts)}
            sub={`${fmt(activeProducts)} active`}
          />
          <MetricCard
            icon={AlertTriangle}
            label="Low Stock Products"
            value={fmt(lowStockCount)}
            sub="Active items at or below threshold"
            iconClass={lowStockCount > 0 ? "text-amber-500" : "text-zinc-500"}
          />
          <MetricCard
            icon={UserCheck}
            label="Staff Members"
            value={fmt(totalStaff)}
            sub="Active staff accounts"
          />
        </div>
      </section>

      {/* ── Order status + Inventory ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Order status */}
        <section aria-labelledby="order-status-heading">
          <SectionTitle id="order-status-heading">Order Status</SectionTitle>
          <Card className="mt-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-zinc-400" aria-hidden="true" />
              <span className="text-sm font-medium text-zinc-700">
                {fmt(orderStatusTotal)} total orders
              </span>
            </div>

            {/* Progress bar */}
            {orderStatusTotal > 0 && (
              <div className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                {["pending", "processing", "completed", "cancelled"].map(
                  (status) => {
                    const count = orderStatistics[status] ?? 0;
                    const pct = (count / orderStatusTotal) * 100;
                    return pct > 0 ? (
                      <div
                        key={status}
                        title={`${STATUS_CONFIG[status]?.label}: ${fmt(count)}`}
                        style={{ width: `${pct}%` }}
                        className={`${STATUS_CONFIG[status]?.bar} transition-all`}
                      />
                    ) : null;
                  },
                )}
              </div>
            )}

            <ul className="mt-4 space-y-3" aria-label="Order statuses">
              {["pending", "processing", "completed", "cancelled"].map(
                (status) => {
                  const count = orderStatistics[status] ?? 0;
                  const cfg = STATUS_CONFIG[status];
                  const pct =
                    orderStatusTotal > 0
                      ? Math.round((count / orderStatusTotal) * 100)
                      : 0;
                  return (
                    <li
                      key={status}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`h-2 w-2 rounded-full ${cfg.dot}`}
                          aria-hidden="true"
                        />
                        <span className="text-sm text-zinc-700 capitalize">
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-400">{pct}%</span>
                        <span className="w-8 text-right text-sm font-semibold text-zinc-900">
                          {fmt(count)}
                        </span>
                      </div>
                    </li>
                  );
                },
              )}
            </ul>
          </Card>
        </section>

        {/* Inventory + Customers */}
        <div className="space-y-6">
          {/* Inventory */}
          <section aria-labelledby="inventory-heading">
            <SectionTitle id="inventory-heading">Inventory</SectionTitle>
            <Card className="mt-3">
              <div className="flex items-center gap-2">
                <Boxes className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                <span className="text-sm font-medium text-zinc-700">
                  {fmt(totalProducts)} total products
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { label: "Active", value: activeProducts, cls: "text-emerald-600" },
                  { label: "Inactive", value: inactiveProducts, cls: "text-zinc-400" },
                  {
                    label: "Low Stock",
                    value: lowStockCount,
                    cls: lowStockCount > 0 ? "text-amber-600" : "text-zinc-400",
                  },
                  {
                    label: "Out of Stock",
                    value: outOfStockProducts,
                    cls: outOfStockProducts > 0 ? "text-red-600" : "text-zinc-400",
                  },
                ].map(({ label, value, cls }) => (
                  <div
                    key={label}
                    className="rounded-md border border-zinc-100 bg-zinc-50 p-3"
                  >
                    <dt className="text-xs text-zinc-500">{label}</dt>
                    <dd className={`mt-0.5 text-xl font-bold ${cls}`}>
                      {fmt(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          </section>

          {/* Customers */}
          <section aria-labelledby="customers-heading">
            <SectionTitle id="customers-heading">Customers</SectionTitle>
            <Card className="mt-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                <span className="text-sm font-medium text-zinc-700">
                  {fmt(totalCustomers)} total customers
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
                  <dt className="text-xs text-zinc-500">Active</dt>
                  <dd className="mt-0.5 text-xl font-bold text-emerald-600">
                    {fmt(activeCustomers)}
                  </dd>
                </div>
                <div className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
                  <dt className="text-xs text-zinc-500">Inactive</dt>
                  <dd className="mt-0.5 text-xl font-bold text-zinc-400">
                    {fmt(inactiveCustomers)}
                  </dd>
                </div>
              </dl>
            </Card>
          </section>
        </div>
      </div>

      {/* ── Recent Orders ── */}
      <section aria-labelledby="recent-orders-heading">
        <SectionTitle id="recent-orders-heading">Recent Orders</SectionTitle>
        <Card className="mt-3 p-0">
          {recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart
                className="h-8 w-8 text-zinc-300"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-medium text-zinc-500">
                No orders yet
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Orders will appear here once customers place them.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="w-full text-sm"
                aria-label="Recent orders"
              >
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th
                      scope="col"
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400"
                    >
                      Order ID
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400"
                    >
                      Customer
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400"
                    >
                      Amount
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400 sm:table-cell"
                    >
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {recentOrders.map((order) => (
                    <tr key={order._id} className="hover:bg-zinc-50">
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs text-zinc-500">
                          #{String(order._id).slice(-6).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {order.customer ? (
                          <div>
                            <p className="font-medium text-zinc-800">
                              {order.customer.name}
                            </p>
                            <p className="text-xs text-zinc-400">
                              {order.customer.email}
                            </p>
                          </div>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-zinc-900">
                        {fmtCurrency(order.totalAmount ?? order.total)}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="hidden px-5 py-3.5 text-zinc-500 sm:table-cell">
                        {fmtDate(order.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      {/* ── Low Stock + Top Products ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Low stock */}
        <section aria-labelledby="low-stock-heading">
          <SectionTitle id="low-stock-heading">Low Stock Products</SectionTitle>
          <Card className="mt-3 p-0">
            {lowStockProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-medium text-zinc-700">
                  Inventory is healthy
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  No products are currently low on stock.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100" aria-label="Low stock products">
                {lowStockProducts.map((product) => (
                  <li
                    key={product._id}
                    className="flex items-center justify-between px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-800">
                        {product.name}
                      </p>
                      <p className="text-xs text-zinc-400 capitalize">
                        {product.status?.replace("_", " ")}
                      </p>
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      <span
                        className={`text-lg font-bold ${
                          product.stock === 0
                            ? "text-red-600"
                            : product.stock <= 2
                            ? "text-red-500"
                            : "text-amber-600"
                        }`}
                        aria-label={`${product.stock} in stock`}
                      >
                        {product.stock}
                      </span>
                      <span className="text-xs text-zinc-400">in stock</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        {/* Top products */}
        <section aria-labelledby="top-products-heading">
          <SectionTitle id="top-products-heading">Top Products</SectionTitle>
          <Card className="mt-3 p-0">
            {topProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <TrendingUp
                  className="h-8 w-8 text-zinc-300"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-medium text-zinc-500">
                  No sales data yet
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Top products will appear once orders are completed.
                </p>
              </div>
            ) : (
              <ul
                className="divide-y divide-zinc-100"
                aria-label="Top selling products"
              >
                {topProducts.map((product, index) => (
                  <li
                    key={product.productId ?? index}
                    className="flex items-center gap-4 px-5 py-3.5"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-500">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-800">
                        {product.name}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {fmt(product.quantitySold)} sold
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-zinc-900">
                      {fmtCurrency(product.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
