import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Plus,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  Trash2,
  ShoppingBag,
} from "lucide-react";
import {
  getOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  deleteOrder,
} from "../services/orders/orderService.js";
import { getCustomers } from "../services/customers/customerService.js";
import { getProducts } from "../services/products/productService.js";

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

// ── Small helpers ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    pending: {
      pill: "border-amber-200 bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
    },
    processing: {
      pill: "border-emerald-200 bg-emerald-50 text-emerald-700",
      dot: "bg-emerald-500",
    },
    completed: {
      pill: "border-zinc-200 bg-zinc-50 text-zinc-500",
      dot: "bg-zinc-400",
    },
    cancelled: {
      pill: "border-red-200 bg-red-50 text-red-700",
      dot: "bg-red-500",
    },
  };
  const style = map[status] || map.completed;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${style.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

// ── Toast (lightweight) ───────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const cls =
    type === "success"
      ? "bg-zinc-900 text-white"
      : "border border-red-200 bg-red-50 text-red-800";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-5 right-5 z-[60] flex items-center gap-2.5 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${cls}`}
    >
      {type === "error" && (
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span>{message}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="ml-2 opacity-60 hover:opacity-100 focus:outline-none"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Field (reusable) ─────────────────────────────────────────────────────────

function Field({ id, label, error, required, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-800">
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls = (hasError) =>
  `block w-full rounded-md border px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:outline-none focus:ring-2 ${
    hasError
      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
      : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900"
  } disabled:cursor-not-allowed disabled:bg-zinc-100`;

// ── Confirmation modal (cancel / delete) ──────────────────────────────────────

function ConfirmModal({ title, message, confirmLabel, action, onCancel, onDone }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && !submitting) onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel, submitting]);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await action();
      onDone();
    } catch (err) {
      setError(err.message || "The request could not be completed.");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6">
        <h2 id="confirm-title" className="text-base font-semibold text-zinc-900">
          {title}
        </h2>
        <div className="mt-2 text-sm text-zinc-600">{message}</div>
        {error && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-60"
          >
            Keep Order
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:opacity-60"
          >
            {submitting && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {submitting ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
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

  // The customer select only renders after the picker data resolves, so focus
  // it once loading finishes rather than on mount (when it is not yet present).
  useEffect(() => {
    if (!loadingPickers && !pickerError) {
      firstRef.current?.focus();
    }
  }, [loadingPickers, pickerError]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    const loadPickers = async () => {
      setLoadingPickers(true);
      setPickerError(null);
      try {
        const [custRes, prodRes] = await Promise.all([
          getCustomers({
            status: "active",
            limit: 100,
            sortBy: "name",
            sortOrder: "asc",
          }),
          getProducts({
            status: "active",
            limit: 100,
            sortBy: "name",
            sortOrder: "asc",
          }),
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
    return () => {
      active = false;
    };
  }, []);

  const productById = useMemo(() => {
    const map = new Map();
    for (const p of products) map.set(p._id, p);
    return map;
  }, [products]);

  // Clear a specific validation error as the user fixes it.
  const clearError = (key) => {
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    if (apiError) setApiError(null);
  };

  const updateItem = (index, patch) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
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
    setItems((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
    );
  };

  // Options for a row: every active product except those chosen in other rows,
  // plus whatever this row already has selected.
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

    if (items.length === 0) {
      errs.items = "Add at least one product.";
    }

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

  // Map backend field errors back onto the relevant inputs.
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
    // Business errors (inactive customer / product, out of stock, etc.) surface
    // as a banner so the backend message is never hidden.
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

  const selectCls = "block w-full appearance-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100";

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-create-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full flex-col rounded-t-xl border border-zinc-200 bg-white sm:max-w-2xl sm:rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 id="order-create-title" className="text-base font-semibold text-zinc-900">
            New Order
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close dialog"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {apiError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
                  aria-hidden="true"
                />
                <span>{apiError}</span>
              </div>
            )}

            {loadingPickers && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center justify-center gap-2.5 py-10 text-sm text-zinc-500"
              >
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Loading order options…</span>
              </div>
            )}

            {!loadingPickers && pickerError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
                  aria-hidden="true"
                />
                <span>{pickerError}</span>
              </div>
            )}

            {!loadingPickers && !pickerError && (
              <>
                {/* Customer */}
                <Field
                  id="o-customer"
                  label="Customer"
                  required
                  error={errors.customer}
                >
                  <select
                    id="o-customer"
                    ref={firstRef}
                    value={customer}
                    onChange={(e) => {
                      setCustomer(e.target.value);
                      clearError("customer");
                    }}
                    disabled={saving}
                    aria-invalid={Boolean(errors.customer)}
                    aria-describedby={
                      errors.customer ? "o-customer-error" : undefined
                    }
                    className={inputCls(errors.customer)}
                  >
                    <option value="">Select a customer…</option>
                    {customers.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                        {c.email ? ` — ${c.email}` : ""}
                      </option>
                    ))}
                  </select>
                  {customers.length === 0 && (
                    <p className="mt-1.5 text-xs text-zinc-500">
                      No active customers available to order for.
                    </p>
                  )}
                </Field>

                {/* Line items */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="block text-sm font-medium text-zinc-800">
                      Items
                      <span className="ml-0.5 text-red-500" aria-hidden="true">
                        *
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={addItem}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-60"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Add Item
                    </button>
                  </div>
                  {errors.items && (
                    <p
                      role="alert"
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600"
                    >
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {errors.items}
                    </p>
                  )}

                  <div className="mt-2 space-y-3">
                    {items.map((item, index) => {
                      const product = productById.get(item.product);
                      const lineTotal = computeLineTotal(item);
                      const rowOptions = optionsForRow(index);
                      // Keep the current selection visible even if it's excluded elsewhere.
                      const currentMissing =
                        item.product &&
                        !rowOptions.some((p) => p._id === item.product);
                      return (
                        <div
                          key={index}
                          className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3"
                        >
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                            <div className="sm:col-span-6">
                              <label
                                htmlFor={`o-product-${index}`}
                                className="block text-xs font-medium text-zinc-500"
                              >
                                Product
                              </label>
                              <select
                                id={`o-product-${index}`}
                                value={item.product}
                                onChange={(e) =>
                                  handleProductChange(index, e.target.value)
                                }
                                disabled={saving}
                                aria-invalid={Boolean(errors[`p${index}`])}
                                className={`mt-1 ${inputCls(errors[`p${index}`])}`}
                              >
                                <option value="">Select a product…</option>
                                {currentMissing && (
                                  <option value={item.product}>
                                    {product?.name || item.product}
                                  </option>
                                )}
                                {rowOptions.map((p) => (
                                  <option key={p._id} value={p._id}>
                                    {p.name} — {p.category} (stock {p.stock})
                                  </option>
                                ))}
                              </select>
                              {errors[`p${index}`] && (
                                <p
                                  role="alert"
                                  className="mt-1 flex items-center gap-1.5 text-xs font-medium text-red-600"
                                >
                                  <AlertCircle
                                    className="h-3.5 w-3.5 shrink-0"
                                    aria-hidden="true"
                                  />
                                  {errors[`p${index}`]}
                                </p>
                              )}
                            </div>

                            <div className="sm:col-span-3">
                              <label
                                htmlFor={`o-quantity-${index}`}
                                className="block text-xs font-medium text-zinc-500"
                              >
                                Quantity
                              </label>
                              <input
                                id={`o-quantity-${index}`}
                                type="number"
                                min="1"
                                step="1"
                                inputMode="numeric"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleQuantityChange(index, e.target.value)
                                }
                                disabled={saving || !product}
                                aria-invalid={Boolean(errors[`q${index}`])}
                                className={`mt-1 ${inputCls(errors[`q${index}`])}`}
                              />
                              {errors[`q${index}`] ? (
                                <p
                                  role="alert"
                                  className="mt-1 flex items-center gap-1.5 text-xs font-medium text-red-600"
                                >
                                  <AlertCircle
                                    className="h-3.5 w-3.5 shrink-0"
                                    aria-hidden="true"
                                  />
                                  {errors[`q${index}`]}
                                </p>
                              ) : (
                                product && (
                                  <p className="mt-1 text-xs text-zinc-500">
                                    Available stock: {product.stock}
                                  </p>
                                )
                              )}
                            </div>

                            <div className="flex items-end justify-between sm:col-span-3 sm:flex-col sm:items-end sm:gap-1">
                              <div className="text-right">
                                <span className="block text-xs font-medium text-zinc-500">
                                  Line total
                                </span>
                                <span className="block text-sm font-semibold tabular-nums text-zinc-900">
                                  {lineTotal === null ? "—" : formatPrice(lineTotal)}
                                </span>
                                {product && (
                                  <span className="block text-xs text-zinc-400">
                                    @{formatPrice(product.price)} each
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                disabled={saving || items.length <= 1}
                                aria-label="Remove item"
                                className="mt-2 rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Running total */}
                <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <span className="text-sm font-medium text-zinc-600">
                    Order total
                  </span>
                  <span className="text-base font-semibold tabular-nums text-zinc-900">
                    {formatPrice(orderTotal)}
                  </span>
                </div>
                <p className="-mt-2 text-xs text-zinc-400">
                  Prices and total are confirmed by the server when the order is
                  created.
                </p>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-zinc-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loadingPickers || Boolean(pickerError)}
              className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-60"
            >
              {saving && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {saving ? "Creating…" : "Create Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Order detail modal ────────────────────────────────────────────────────────

function OrderDetailModal({ orderId, onClose, notify, reloadList }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // { kind: 'cancel' | 'delete', to }

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, busy]);

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

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (to, toastMessage) => {
    setBusy(true);
    try {
      await updateOrderStatus(order._id, to);
      notify(toastMessage, "success");
      await load(); // PUT response is unpopulated — refetch to refresh.
      reloadList();
    } catch (err) {
      notify(err.message || "Failed to update order.", "error");
    } finally {
      setBusy(false);
    }
  };

  const runAction = async () => {
    if (confirm.kind === "cancel") {
      await updateOrderStatus(order._id, "cancelled");
    } else {
      await deleteOrder(order._id);
    }
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

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full flex-col rounded-t-xl border border-zinc-200 bg-white sm:max-w-xl sm:rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 id="order-detail-title" className="text-base font-semibold text-zinc-900">
            Order Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-center gap-2.5 py-12 text-sm text-zinc-500"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Loading order…</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="mt-3 font-medium text-zinc-900">Failed to load order</p>
              <p className="mt-1 text-sm text-zinc-500">{error}</p>
              <button
                type="button"
                onClick={load}
                className="mt-4 inline-flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Retry
              </button>
            </div>
          )}

          {!loading && !error && order && (
            <div className="space-y-6">
              {/* Meta */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <StatusBadge status={order.status} />
                <p className="text-xs text-zinc-500">
                  Placed {formatDateTime(order.createdAt)}
                </p>
              </div>

              {/* Customer */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Customer
                </h3>
                <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 text-sm">
                  <p className="font-medium text-zinc-900">
                    {orDash(order.customer?.name)}
                  </p>
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

              {/* Items */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Items
                </h3>
                <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 bg-zinc-50/60 text-left">
                        <th scope="col" className="px-4 py-2.5 font-medium text-zinc-500">
                          Product
                        </th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium text-zinc-500">
                          Qty
                        </th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium text-zinc-500">
                          Unit price
                        </th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium text-zinc-500">
                          Line total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {(order.items || []).map((item, index) => (
                        <tr key={item.product?._id || index}>
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-zinc-900">
                              {orDash(item.product?.name)}
                            </p>
                            {item.product?.category && (
                              <p className="text-xs text-zinc-400">
                                {item.product.category}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700">
                            {formatPrice(item.price)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-900">
                            {formatPrice(item.price * item.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-zinc-200 bg-zinc-50/60">
                        <td
                          colSpan={3}
                          className="px-4 py-2.5 text-right font-medium text-zinc-600"
                        >
                          Total
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-zinc-900">
                          {formatPrice(order.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Timestamps */}
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
        </div>

        {/* Footer actions */}
        {!loading && !error && order && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 px-6 py-4">
            {canDelete && (
              <button
                type="button"
                onClick={() => setConfirm({ kind: "delete" })}
                disabled={busy}
                className="mr-auto inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </button>
            )}
            {actions.map((action) => (
              <button
                key={action.to}
                type="button"
                disabled={busy}
                onClick={() =>
                  action.confirm
                    ? setConfirm({ kind: "cancel", to: action.to })
                    : changeStatus(action.to, action.toast)
                }
                className={
                  action.to === "cancelled"
                    ? "rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-60"
                    : "rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-60"
                }
              >
                {action.label === "Cancel" ? "Cancel Order" : action.label}
              </button>
            ))}
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-60"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {confirm && (
        <ConfirmModal
          title={confirm.kind === "cancel" ? "Cancel Order" : "Delete Order"}
          confirmLabel={confirm.kind === "cancel" ? "Cancel Order" : "Delete"}
          message={
            confirm.kind === "cancel" ? (
              <p>
                Cancelling this order will restore its reserved stock. This
                cannot be undone.
              </p>
            ) : order?.status === "cancelled" ? (
              <p>
                Are you sure you want to delete this cancelled order? Its stock
                was already restored during cancellation.
              </p>
            ) : (
              <p>
                Deleting this order will restore its reserved stock. This action
                cannot be undone.
              </p>
            )
          }
          action={runAction}
          onCancel={() => setConfirm(null)}
          onDone={onConfirmDone}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  // List state
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [rowBusy, setRowBusy] = useState(null);

  // Query state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);

  // Customer filter options (active customers)
  const [filterCustomers, setFilterCustomers] = useState([]);
  const [customersError, setCustomersError] = useState(null);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind, order, to }

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type, key: Date.now() });
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // Load active customers for the filter dropdown (non-blocking on failure).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await getCustomers({
          status: "active",
          limit: 100,
          sortBy: "name",
          sortOrder: "asc",
        });
        if (active) setFilterCustomers(res.data.customers || []);
      } catch (err) {
        if (active)
          setCustomersError(err.message || "Failed to load customers.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Load orders
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

  useEffect(() => {
    load();
  }, [load]);

  // Direct (non-cancel) status change from a row.
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
    if (confirm.kind === "cancel") {
      await updateOrderStatus(confirm.order._id, "cancelled");
    } else {
      await deleteOrder(confirm.order._id);
    }
  };

  const onConfirmDone = () => {
    const { kind, order } = confirm;
    setConfirm(null);
    if (kind === "cancel") {
      showToast("Order cancelled and stock restored.", "success");
      load();
      return;
    }
    // delete
    showToast("Order deleted successfully.", "success");
    if (detailId === order._id) setDetailId(null);
    if (orders.length === 1 && page > 1) setPage((p) => p - 1);
    else load();
  };

  const hasFilters = Boolean(debouncedSearch || statusFilter || customerFilter);
  const isEmpty = !loading && !listError && orders.length === 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Orders
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage customer orders and order status
            {pagination.total > 0 &&
              ` · ${pagination.total.toLocaleString()} total`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Order
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-zinc-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name or email…"
            aria-label="Search orders by customer"
            className="block w-full rounded-md border border-zinc-300 py-2 pr-9 pl-9 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute inset-y-0 right-2.5 my-auto text-zinc-400 hover:text-zinc-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Customer filter */}
        <select
          value={customerFilter}
          onChange={(e) => {
            setCustomerFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by customer"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 lg:w-auto"
        >
          <option value="">All customers</option>
          {filterCustomers.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 lg:w-auto"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Sort */}
        <select
          value={`${sortBy}:${sortOrder}`}
          onChange={(e) => {
            const [field, order] = e.target.value.split(":");
            setSortBy(field);
            setSortOrder(order);
            setPage(1);
          }}
          aria-label="Sort orders"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 lg:w-auto"
        >
          {SORT_FIELDS.map((f) => (
            <optgroup key={f.value} label={f.label}>
              <option value={`${f.value}:asc`}>{f.label} — ascending</option>
              <option value={`${f.value}:desc`}>{f.label} — descending</option>
            </optgroup>
          ))}
        </select>
      </div>

      {customersError && (
        <p className="-mt-3 text-xs text-amber-700" role="status">
          Customer filter unavailable: {customersError}
        </p>
      )}

      {/* Content */}
      <div className="rounded-lg border border-zinc-200 bg-white">
        {/* Loading */}
        {loading && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2.5 py-16 text-sm text-zinc-500"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Loading orders…</span>
          </div>
        )}

        {/* Error */}
        {!loading && listError && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-3 font-medium text-zinc-900">Failed to load orders</p>
            <p className="mt-1 text-sm text-zinc-500">{listError}</p>
            <button
              type="button"
              onClick={load}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
              <ShoppingBag className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-3 font-medium text-zinc-700">
              {hasFilters ? "No orders match your filters" : "No orders yet"}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {hasFilters
                ? "Try adjusting your search or filter criteria."
                : "Create your first order to get started."}
            </p>
            {!hasFilters && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New Order
              </button>
            )}
          </div>
        )}

        {/* Table */}
        {!loading && !listError && orders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Order list">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60">
                  <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Date
                  </th>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Customer
                  </th>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Items
                  </th>
                  <th scope="col" className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Total
                  </th>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {orders.map((o) => {
                  const actions = STATUS_ACTIONS[o.status] || [];
                  const canDelete = ORDERABLE_STATUS[o.status]?.canDelete;
                  const itemCount = (o.items || []).length;
                  const summary = (o.items || [])
                    .map((it) => it.product?.name)
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <tr key={o._id} className="hover:bg-zinc-50/50">
                      {/* Date */}
                      <td className="whitespace-nowrap px-5 py-3.5 text-zinc-600">
                        {formatDateTime(o.createdAt)}
                      </td>
                      {/* Customer */}
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-zinc-900">
                          {orDash(o.customer?.name)}
                        </p>
                        {o.customer?.email && (
                          <p className="max-w-[220px] truncate text-xs text-zinc-400">
                            {o.customer.email}
                          </p>
                        )}
                      </td>
                      {/* Items */}
                      <td className="px-5 py-3.5 text-zinc-600">
                        <span>{itemCount}</span>
                        {summary && (
                          <p className="max-w-[220px] truncate text-xs text-zinc-400">
                            {summary}
                          </p>
                        )}
                      </td>
                      {/* Total */}
                      <td className="px-5 py-3.5 text-right tabular-nums text-zinc-900">
                        {formatPrice(o.totalAmount)}
                      </td>
                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <StatusBadge status={o.status} />
                      </td>
                      {/* Actions */}
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
                          <button
                            type="button"
                            onClick={() => setDetailId(o._id)}
                            aria-label={`View order ${orDash(o.customer?.name)}`}
                            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setConfirm({ kind: "delete", order: o })}
                              aria-label={`Delete order ${orDash(o.customer?.name)}`}
                              className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !listError && pagination.totalPages > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3.5 sm:flex-row">
            <p className="text-xs text-zinc-500">
              Showing{" "}
              <span className="font-medium text-zinc-700">
                {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, pagination.total)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-zinc-700">
                {pagination.total}
              </span>{" "}
              orders
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
                aria-label="Previous page"
                className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[5rem] text-center text-xs text-zinc-600">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= pagination.totalPages}
                aria-label="Next page"
                className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
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

      {/* Detail modal */}
      {detailId && (
        <OrderDetailModal
          orderId={detailId}
          onClose={() => setDetailId(null)}
          notify={showToast}
          reloadList={load}
        />
      )}

      {/* Confirm modal (cancel / delete from list rows) */}
      {confirm && (
        <ConfirmModal
          title={confirm.kind === "cancel" ? "Cancel Order" : "Delete Order"}
          confirmLabel={confirm.kind === "cancel" ? "Cancel Order" : "Delete"}
          message={
            confirm.kind === "cancel" ? (
              <p>
                Cancelling this order will restore its reserved stock. This
                cannot be undone.
              </p>
            ) : confirm.order.status === "cancelled" ? (
              <p>
                Are you sure you want to delete this cancelled order? Its stock
                was already restored during cancellation.
              </p>
            ) : (
              <p>
                Deleting this order will restore its reserved stock. This action
                cannot be undone.
              </p>
            )
          }
          action={runConfirmAction}
          onCancel={() => setConfirm(null)}
          onDone={onConfirmDone}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          key={toast.key}
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
