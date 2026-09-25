import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Plus, Eye, Trash2, ShoppingBag } from "lucide-react";
import {
  getOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  deleteOrder,
} from "../services/orders/orderService.js";
import { getCustomers } from "../services/customers/customerService.js";
import { getProducts } from "../services/products/productService.js";
import {
  Button,
  Badge,
  Card,
  Alert,
  Modal,
  ConfirmModal,
  Toast,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchInput,
  FilterSelect,
  Pagination,
  IconButton,
  LoadingState,
  Field,
  Input,
  Select,
} from "../components/ui/index.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const SORT_FIELDS = [
  { value: "createdAt", label: "Date Added" },
  { value: "updatedAt", label: "Last Updated" },
  { value: "totalAmount", label: "Total" },
  { value: "status", label: "Status" },
];

const STATUS_LABELS = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  cancelled: "Cancelled",
};

// Semantic tones follow the app-wide status rules:
// pending → amber, processing → neutral, completed → emerald, cancelled → red.
const STATUS_TONES = {
  pending: "warning",
  processing: "neutral",
  completed: "success",
  cancelled: "danger",
};

// Valid forward transitions, mirroring the backend state machine. Cancel is
// routed through a confirmation modal; the others execute directly.
const STATUS_ACTIONS = {
  pending: [
    { label: "Process", to: "processing", toast: "Order marked as processing." },
    { label: "Cancel", to: "cancelled", confirm: true },
  ],
  processing: [
    { label: "Complete", to: "completed", toast: "Order marked as completed." },
    { label: "Cancel", to: "cancelled", confirm: true },
  ],
  completed: [],
  cancelled: [],
};

const ORDERABLE_STATUS = {
  pending: { canDelete: true },
  processing: { canDelete: true },
  completed: { canDelete: false },
  cancelled: { canDelete: true },
};

// Price is stored as a bare number with no currency on the backend, so it is
// rendered as a grouped decimal only — no symbol is assumed.
const formatPrice = (value) =>
  Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDateTime = (iso) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const orDash = (value) => (value && String(value).trim() ? value : "—");

function StatusBadge({ status }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"} dot>
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}

// ── Create Order modal ────────────────────────────────────────────────────────

const EMPTY_ITEM = { product: "", quantity: "1" };

function CreateOrderModal({ onClose, onCreated }) {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingPickers, setLoadingPickers] = useState(true);
  const [pickerError, setPickerError] = useState(null);

  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState([EMPTY_ITEM]);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [saving, setSaving] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    if (!loadingPickers && !pickerError) firstRef.current?.focus();
  }, [loadingPickers, pickerError]);

  useEffect(() => {
    let active = true;
    const loadPickers = async () => {
      setLoadingPickers(true);
      setPickerError(null);
      try {
        const [custRes, prodRes] = await Promise.all([
          getCustomers({ status: "active", limit: 100, sortBy: "name", sortOrder: "asc" }),
          getProducts({ status: "active", limit: 100, sortBy: "name", sortOrder: "asc" }),
        ]);
        if (!active) return;
        setCustomers(custRes.data.customers || []);
        setProducts(prodRes.data.products || []);
      } catch (err) {
        if (!active) return;
        setPickerError(err.message || "Failed to load order options.");
      } finally {
        if (active) setLoadingPickers(false);
      }
    };
    loadPickers();
    return () => { active = false; };
  }, []);

  const productById = useMemo(() => {
    const map = new Map();
    for (const p of products) map.set(p._id, p);
    return map;
  }, [products]);

  const clearError = (key) => {
    if (errors[key]) setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
    if (apiError) setApiError(null);
  };

  const updateItem = (index, patch) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const handleProductChange = (index, productId) => {
    updateItem(index, { product: productId, quantity: "1" });
    clearError(`p${index}`);
  };

  const handleQuantityChange = (index, raw) => {
    updateItem(index, { quantity: raw });
    clearError(`q${index}`);
  };

  const addItem = () => setItems((prev) => [...prev, EMPTY_ITEM]);

  const removeItem = (index) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const optionsForRow = (index) => {
    const usedElsewhere = new Set(
      items.filter((_, i) => i !== index).map((it) => it.product).filter(Boolean),
    );
    return products.filter((p) => !usedElsewhere.has(p._id));
  };

  const computeLineTotal = (item) => {
    const product = productById.get(item.product);
    const qty = Number(item.quantity);
    if (!product || Number.isNaN(qty)) return null;
    return product.price * qty;
  };

  const orderTotal = items.reduce((sum, item) => {
    const line = computeLineTotal(item);
    return line === null ? sum : sum + line;
  }, 0);

  const validate = () => {
    const errs = {};
    if (!customer) errs.customer = "Please select a customer.";
    if (items.length === 0) errs.items = "Add at least one product.";

    const seen = new Set();
    items.forEach((item, index) => {
      if (!item.product) {
        errs[`p${index}`] = "Select a product.";
      } else if (seen.has(item.product)) {
        errs.items = "Duplicate products are not allowed.";
      } else {
        seen.add(item.product);
      }

      const product = productById.get(item.product);
      const qty = Number(item.quantity);
      if (item.quantity === "" || Number.isNaN(qty)) {
        errs[`q${index}`] = "Quantity is required.";
      } else if (!Number.isInteger(qty)) {
        errs[`q${index}`] = "Quantity must be a whole number.";
      } else if (qty < 1) {
        errs[`q${index}`] = "Quantity must be at least 1.";
      } else if (product && qty > product.stock) {
        errs[`q${index}`] = `Only ${product.stock} in stock.`;
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const applyApiError = (err) => {
    const message = err.message || "The request could not be completed.";
    const fieldErrors = {};
    for (const detail of err.details || []) {
      if (!detail?.field || !detail?.message) continue;
      const productMatch = /^items\[(\d+)\]\.product$/.exec(detail.field);
      const qtyMatch = /^items\[(\d+)\]\.quantity$/.exec(detail.field);
      if (detail.field === "customer") fieldErrors.customer = detail.message;
      else if (productMatch) fieldErrors[`p${productMatch[1]}`] = detail.message;
      else if (qtyMatch) fieldErrors[`q${qtyMatch[1]}`] = detail.message;
      else if (detail.field === "items") fieldErrors.items = detail.message;
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...fieldErrors }));
    }
    setApiError(message);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loadingPickers) return;
    if (pickerError) {
      setApiError("Order options failed to load. Close and try again.");
      return;
    }
    if (!validate()) return;

    setSaving(true);
    setApiError(null);

    const payload = {
      customer,
      items: items.map((item) => ({
        product: item.product,
        quantity: Number(item.quantity),
      })),
    };

    try {
      await createOrder(payload);
      onCreated();
    } catch (err) {
      applyApiError(err);
      setSaving(false);
    }
  };

  return (
    <Modal
      title="New Order"
      titleId="order-create-title"
      onClose={onClose}
      size="2xl"
      locked={saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-order-form"
            loading={saving}
            disabled={loadingPickers || Boolean(pickerError)}
          >
            {saving ? "Creating…" : "Create Order"}
          </Button>
        </>
      }
    >
      <form id="create-order-form" onSubmit={handleSubmit} noValidate className="space-y-5">
        {apiError && <Alert variant="danger">{apiError}</Alert>}

        {loadingPickers && <LoadingState label="Loading order options…" className="py-10" />}

        {!loadingPickers && pickerError && <Alert variant="danger">{pickerError}</Alert>}

        {!loadingPickers && !pickerError && (
          <>
            <Field id="o-customer" label="Customer" required error={errors.customer}>
              <Select
                id="o-customer"
                ref={firstRef}
                value={customer}
                onChange={(e) => { setCustomer(e.target.value); clearError("customer"); }}
                disabled={saving}
                invalid={Boolean(errors.customer)}
                aria-describedby={errors.customer ? "o-customer-error" : undefined}
              >
                <option value="">Select a customer…</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                    {c.email ? ` — ${c.email}` : ""}
                  </option>
                ))}
              </Select>
              {customers.length === 0 && (
                <p className="mt-1.5 text-xs text-zinc-500">
                  No active customers available to order for.
                </p>
              )}
            </Field>

            <div>
              <div className="flex items-center justify-between">
                <span className="block text-sm font-medium text-zinc-800">
                  Items
                  <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
                </span>
                <Button variant="secondary" size="sm" icon={Plus} onClick={addItem} disabled={saving}>
                  Add Item
                </Button>
              </div>
              {errors.items && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{errors.items}</p>
              )}

              <div className="mt-2 space-y-3">
                {items.map((item, index) => {
                  const product = productById.get(item.product);
                  const lineTotal = computeLineTotal(item);
                  const rowOptions = optionsForRow(index);
                  const currentMissing =
                    item.product && !rowOptions.some((p) => p._id === item.product);
                  return (
                    <div key={index} className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                        <div className="sm:col-span-6">
                          <label htmlFor={`o-product-${index}`} className="block text-xs font-medium text-zinc-500">
                            Product
                          </label>
                          <Select
                            id={`o-product-${index}`}
                            value={item.product}
                            onChange={(e) => handleProductChange(index, e.target.value)}
                            disabled={saving}
                            invalid={Boolean(errors[`p${index}`])}
                            className="mt-1"
                          >
                            <option value="">Select a product…</option>
                            {currentMissing && (
                              <option value={item.product}>{product?.name || item.product}</option>
                            )}
                            {rowOptions.map((p) => (
                              <option key={p._id} value={p._id}>
                                {p.name} — {p.category} (stock {p.stock})
                              </option>
                            ))}
                          </Select>
                          {errors[`p${index}`] && (
                            <p role="alert" className="mt-1 text-xs font-medium text-red-600">
                              {errors[`p${index}`]}
                            </p>
                          )}
                        </div>

                        <div className="sm:col-span-3">
                          <label htmlFor={`o-quantity-${index}`} className="block text-xs font-medium text-zinc-500">
                            Quantity
                          </label>
                          <Input
                            id={`o-quantity-${index}`}
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(index, e.target.value)}
                            disabled={saving || !product}
                            invalid={Boolean(errors[`q${index}`])}
                            className="mt-1"
                          />
                          {errors[`q${index}`] ? (
                            <p role="alert" className="mt-1 text-xs font-medium text-red-600">
                              {errors[`q${index}`]}
                            </p>
                          ) : (
                            product && (
                              <p className="mt-1 text-xs text-zinc-500">Available stock: {product.stock}</p>
                            )
                          )}
                        </div>

                        <div className="flex items-end justify-between sm:col-span-3 sm:flex-col sm:items-end sm:gap-1">
                          <div className="text-right">
                            <span className="block text-xs font-medium text-zinc-500">Line total</span>
                            <span className="block text-sm font-semibold tabular-nums text-zinc-900">
                              {lineTotal === null ? "—" : formatPrice(lineTotal)}
                            </span>
                            {product && (
                              <span className="block text-xs text-zinc-400">@{formatPrice(product.price)} each</span>
                            )}
                          </div>
                          <IconButton
                            icon={Trash2}
                            tone="danger"
                            label="Remove item"
                            onClick={() => removeItem(index)}
                            disabled={saving || items.length <= 1}
                            className="mt-2 disabled:cursor-not-allowed disabled:opacity-30"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
              <span className="text-sm font-medium text-zinc-600">Order total</span>
              <span className="text-base font-semibold tabular-nums text-zinc-900">{formatPrice(orderTotal)}</span>
            </div>
            <p className="-mt-2 text-xs text-zinc-400">
              Prices and total are confirmed by the server when the order is created.
            </p>
          </>
        )}
      </form>
    </Modal>
  );
}

// ── Order detail modal ────────────────────────────────────────────────────────

function OrderDetailModal({ orderId, onClose, notify, reloadList }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // { kind: 'cancel' | 'delete' }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOrder(orderId);
      setOrder(res.data.order);
    } catch (err) {
      setError(err.message || "Failed to load order.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (to, toastMessage) => {
    setBusy(true);
    try {
      await updateOrderStatus(order._id, to);
      notify(toastMessage, "success");
      await load();
      reloadList();
    } catch (err) {
      notify(err.message || "Failed to update order.", "error");
    } finally {
      setBusy(false);
    }
  };

  const runAction = async () => {
    if (confirm.kind === "cancel") await updateOrderStatus(order._id, "cancelled");
    else await deleteOrder(order._id);
  };

  const onConfirmDone = () => {
    if (confirm.kind === "cancel") {
      notify("Order cancelled and stock restored.", "success");
      setConfirm(null);
      load();
      reloadList();
    } else {
      notify("Order deleted successfully.", "success");
      reloadList();
      onClose();
    }
  };

  const actions = order ? STATUS_ACTIONS[order.status] || [] : [];
  const canDelete = order ? ORDERABLE_STATUS[order.status]?.canDelete : false;

  const footer =
    !loading && !error && order ? (
      <>
        {canDelete && (
          <Button variant="dangerSoft" icon={Trash2} onClick={() => setConfirm({ kind: "delete" })} disabled={busy} className="mr-auto">
            Delete
          </Button>
        )}
        {actions.map((action) =>
          action.to === "cancelled" ? (
            <Button key={action.to} variant="dangerSoft" disabled={busy} onClick={() => setConfirm({ kind: "cancel", to: action.to })}>
              Cancel Order
            </Button>
          ) : (
            <Button key={action.to} disabled={busy} onClick={() => changeStatus(action.to, action.toast)}>
              {action.label}
            </Button>
          ),
        )}
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Close
        </Button>
      </>
    ) : null;

  return (
    <>
      <Modal title="Order Details" titleId="order-detail-title" onClose={onClose} size="xl" locked={busy} footer={footer}>
        {loading && <LoadingState label="Loading order…" className="py-12" />}

        {!loading && error && <ErrorState title="Failed to load order" message={error} onRetry={load} />}

        {!loading && !error && order && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusBadge status={order.status} />
              <p className="text-xs text-zinc-500">Placed {formatDateTime(order.createdAt)}</p>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Customer</h3>
              <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 text-sm">
                <p className="font-medium text-zinc-900">{orDash(order.customer?.name)}</p>
                <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                  <div className="flex gap-1.5">
                    <dt className="text-zinc-500">Email:</dt>
                    <dd className="text-zinc-700">{orDash(order.customer?.email)}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-zinc-500">Phone:</dt>
                    <dd className="text-zinc-700">{orDash(order.customer?.phone)}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-zinc-500">Company:</dt>
                    <dd className="text-zinc-700">{orDash(order.customer?.company)}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-zinc-500">Status:</dt>
                    <dd className="text-zinc-700">{orDash(order.customer?.status)}</dd>
                  </div>
                </dl>
                <p className="mt-1.5 text-zinc-700">
                  <span className="text-zinc-500">Address: </span>
                  {orDash(order.customer?.address)}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Items</h3>
              <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/60 text-left">
                      <th scope="col" className="px-4 py-2.5 font-medium text-zinc-500">Product</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium text-zinc-500">Qty</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium text-zinc-500">Unit price</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium text-zinc-500">Line total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(order.items || []).map((item, index) => (
                      <tr key={item.product?._id || index}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-zinc-900">{orDash(item.product?.name)}</p>
                          {item.product?.category && (
                            <p className="text-xs text-zinc-400">{item.product.category}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700">{item.quantity}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700">{formatPrice(item.price)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-900">
                          {formatPrice(item.price * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-zinc-200 bg-zinc-50/60">
                      <td colSpan={3} className="px-4 py-2.5 text-right font-medium text-zinc-600">Total</td>
                      <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-zinc-900">
                        {formatPrice(order.totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-1 text-xs text-zinc-500 sm:grid-cols-2">
              <div>
                <dt className="inline font-medium text-zinc-600">Created: </dt>
                <dd className="inline">{formatDateTime(order.createdAt)}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-zinc-600">Last updated: </dt>
                <dd className="inline">{formatDateTime(order.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        )}
      </Modal>

      {confirm && (
        <ConfirmModal
          title={confirm.kind === "cancel" ? "Cancel Order" : "Delete Order"}
          confirmLabel={confirm.kind === "cancel" ? "Cancel Order" : "Delete"}
          cancelLabel="Keep Order"
          message={
            confirm.kind === "cancel" ? (
              <p>Cancelling this order will restore its reserved stock. This cannot be undone.</p>
            ) : order?.status === "cancelled" ? (
              <p>Are you sure you want to delete this cancelled order? Its stock was already restored during cancellation.</p>
            ) : (
              <p>Deleting this order will restore its reserved stock. This action cannot be undone.</p>
            )
          }
          action={runAction}
          onCancel={() => setConfirm(null)}
          onDone={onConfirmDone}
        />
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [rowBusy, setRowBusy] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);

  const [filterCustomers, setFilterCustomers] = useState([]);
  const [customersError, setCustomersError] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind, order }

  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type, key: Date.now() });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await getCustomers({ status: "active", limit: 100, sortBy: "name", sortOrder: "asc" });
        if (active) setFilterCustomers(res.data.customers || []);
      } catch (err) {
        if (active) setCustomersError(err.message || "Failed to load customers.");
      }
    })();
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const params = { page, limit: PAGE_SIZE, sortBy, sortOrder };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (customerFilter) params.customer = customerFilter;
      const res = await getOrders(params);
      setOrders(res.data.orders || []);
      setPagination(res.data.pagination);
    } catch (err) {
      setListError(err.message || "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, customerFilter, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (order, action) => {
    setRowBusy(order._id);
    try {
      await updateOrderStatus(order._id, action.to);
      showToast(action.toast, "success");
      load();
    } catch (err) {
      showToast(err.message || "Failed to update order.", "error");
    } finally {
      setRowBusy(null);
    }
  };

  const runConfirmAction = async () => {
    if (confirm.kind === "cancel") await updateOrderStatus(confirm.order._id, "cancelled");
    else await deleteOrder(confirm.order._id);
  };

  const onConfirmDone = () => {
    const { kind, order } = confirm;
    setConfirm(null);
    if (kind === "cancel") {
      showToast("Order cancelled and stock restored.", "success");
      load();
      return;
    }
    showToast("Order deleted successfully.", "success");
    if (detailId === order._id) setDetailId(null);
    if (orders.length === 1 && page > 1) setPage((p) => p - 1);
    else load();
  };

  const hasFilters = Boolean(debouncedSearch || statusFilter || customerFilter);
  const isEmpty = !loading && !listError && orders.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description={
          <>
            Manage customer orders and order status
            {pagination.total > 0 && ` · ${pagination.total.toLocaleString()} total`}
          </>
        }
        action={
          <Button icon={Plus} size="lg" onClick={() => setCreateOpen(true)}>
            New Order
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          className="flex-1"
          value={search}
          onChange={setSearch}
          onClear={() => setSearch("")}
          placeholder="Search by customer name or email…"
          label="Search orders by customer"
        />
        <FilterSelect label="Filter by customer" value={customerFilter} onChange={(v) => { setCustomerFilter(v); setPage(1); }}>
          <option value="">All customers</option>
          {filterCustomers.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </FilterSelect>
        <FilterSelect label="Filter by status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </FilterSelect>
        <FilterSelect
          label="Sort orders"
          value={`${sortBy}:${sortOrder}`}
          onChange={(v) => { const [field, order] = v.split(":"); setSortBy(field); setSortOrder(order); setPage(1); }}
        >
          {SORT_FIELDS.map((f) => (
            <optgroup key={f.value} label={f.label}>
              <option value={`${f.value}:asc`}>{f.label} — ascending</option>
              <option value={`${f.value}:desc`}>{f.label} — descending</option>
            </optgroup>
          ))}
        </FilterSelect>
      </div>

      {customersError && (
        <p className="-mt-3 text-xs text-amber-700" role="status">
          Customer filter unavailable: {customersError}
        </p>
      )}

      <Card padded={false}>
        {loading && <LoadingState label="Loading orders…" />}

        {!loading && listError && (
          <ErrorState title="Failed to load orders" message={listError} onRetry={load} />
        )}

        {isEmpty && (
          <EmptyState
            icon={ShoppingBag}
            title={hasFilters ? "No orders match your filters" : "No orders yet"}
            description={
              hasFilters
                ? "Try adjusting your search or filter criteria."
                : "Create your first order to get started."
            }
            action={
              !hasFilters && (
                <Button icon={Plus} onClick={() => setCreateOpen(true)}>
                  New Order
                </Button>
              )
            }
          />
        )}

        {!loading && !listError && orders.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Order list">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/60">
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Date</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Customer</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Items</th>
                    <th scope="col" className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Total</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Status</th>
                    <th scope="col" className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {orders.map((o) => {
                    const actions = STATUS_ACTIONS[o.status] || [];
                    const canDelete = ORDERABLE_STATUS[o.status]?.canDelete;
                    const itemCount = (o.items || []).length;
                    const summary = (o.items || []).map((it) => it.product?.name).filter(Boolean).join(", ");
                    return (
                      <tr key={o._id} className="hover:bg-zinc-50/50">
                        <td className="whitespace-nowrap px-5 py-3.5 text-zinc-600">{formatDateTime(o.createdAt)}</td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-zinc-900">{orDash(o.customer?.name)}</p>
                          {o.customer?.email && (
                            <p className="max-w-[220px] truncate text-xs text-zinc-400">{o.customer.email}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-zinc-600">
                          <span>{itemCount}</span>
                          {summary && <p className="max-w-[220px] truncate text-xs text-zinc-400">{summary}</p>}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-zinc-900">{formatPrice(o.totalAmount)}</td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            {actions.map((action) => (
                              <button
                                key={action.to}
                                type="button"
                                disabled={rowBusy === o._id}
                                onClick={() =>
                                  action.confirm
                                    ? setConfirm({ kind: "cancel", order: o })
                                    : changeStatus(o, action)
                                }
                                aria-label={`${action.label} order ${orDash(o.customer?.name)}`}
                                className={
                                  action.to === "cancelled"
                                    ? "rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-40"
                                    : "rounded px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-40"
                                }
                              >
                                {action.label}
                              </button>
                            ))}
                            <IconButton icon={Eye} label={`View order ${orDash(o.customer?.name)}`} onClick={() => setDetailId(o._id)} />
                            {canDelete && (
                              <IconButton
                                icon={Trash2}
                                tone="danger"
                                label={`Delete order ${orDash(o.customer?.name)}`}
                                onClick={() => setConfirm({ kind: "delete", order: o })}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 0 && (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={pagination.total}
                totalPages={pagination.totalPages}
                itemLabel="orders"
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </Card>

      {createOpen && (
        <CreateOrderModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            showToast("Order created successfully.", "success");
            setPage(1);
            load();
          }}
        />
      )}

      {detailId && (
        <OrderDetailModal
          orderId={detailId}
          onClose={() => setDetailId(null)}
          notify={showToast}
          reloadList={load}
        />
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.kind === "cancel" ? "Cancel Order" : "Delete Order"}
          confirmLabel={confirm.kind === "cancel" ? "Cancel Order" : "Delete"}
          cancelLabel="Keep Order"
          message={
            confirm.kind === "cancel" ? (
              <p>Cancelling this order will restore its reserved stock. This cannot be undone.</p>
            ) : confirm.order.status === "cancelled" ? (
              <p>Are you sure you want to delete this cancelled order? Its stock was already restored during cancellation.</p>
            ) : (
              <p>Deleting this order will restore its reserved stock. This action cannot be undone.</p>
            )
          }
          action={runConfirmAction}
          onCancel={() => setConfirm(null)}
          onDone={onConfirmDone}
        />
      )}

      {toast && (
        <Toast key={toast.key} message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
