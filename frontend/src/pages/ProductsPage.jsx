import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Plus,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  AlertCircle,
  Loader2,
  Package,
  Tags,
  RefreshCw,
} from "lucide-react";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../services/products/productService.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const SORT_FIELDS = [
  { value: "createdAt", label: "Date Added" },
  { value: "updatedAt", label: "Last Updated" },
  { value: "name", label: "Name" },
  { value: "category", label: "Category" },
  { value: "price", label: "Price" },
  { value: "stock", label: "Stock" },
  { value: "status", label: "Status" },
];

const STATUS_LABELS = {
  active: "Active",
  inactive: "Inactive",
  out_of_stock: "Out of Stock",
};

const EMPTY_FORM = {
  name: "",
  category: "",
  description: "",
  price: "",
  stock: "",
  status: "active",
};

// A saved product is not guaranteed to carry every field — the backend omits
// `description` when it was never set. Build the form from the known field set,
// falling back to each field's default, so every string field is always a
// string before validation or submission touches it.
const toFormValues = (product) =>
  Object.fromEntries(
    Object.entries(EMPTY_FORM).map(([field, fallback]) => {
      const value = product[field];
      return [
        field,
        value === undefined || value === null ? fallback : String(value),
      ];
    }),
  );

// Price is stored as a bare number with no currency on the backend, so it is
// rendered as a grouped decimal only — no symbol is assumed.
const formatPrice = (value) =>
  Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Mirrors the backend stock/status coupling so the form can never submit a
// combination the API would reject.
const deriveStatus = (stock, currentStatus) => {
  if (stock === 0) return "out_of_stock";
  if (currentStatus === "out_of_stock") return "active";
  return currentStatus;
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  }
  if (status === "out_of_stock") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Out of Stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-500">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
      Inactive
    </span>
  );
}

function SortIcon({ field, active, dir }) {
  if (!active) return <ChevronUp className="h-3 w-3 text-zinc-300" />;
  return dir === "asc" ? (
    <ChevronUp className="h-3 w-3 text-zinc-700" />
  ) : (
    <ChevronDown className="h-3 w-3 text-zinc-700" />
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
      className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${cls}`}
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

// ── Product Form Modal ────────────────────────────────────────────────────────

function ProductModal({ mode, initial, onClose, onSaved }) {
  const [form, setForm] = useState(
    () => (initial ? toFormValues(initial) : { ...EMPTY_FORM }),
  );
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [saving, setSaving] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const stockNum = Number(form.stock);
  const hasStock = form.stock !== "" && !Number.isNaN(stockNum);

  // Keep the offered statuses in step with the stock value.
  const statusOptions = useMemo(() => {
    if (hasStock && stockNum === 0) return ["out_of_stock"];
    return ["active", "inactive"];
  }, [hasStock, stockNum]);

  const set = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (apiError) setApiError(null);
  };

  const setStock = (e) => {
    const raw = e.target.value;
    setForm((prev) => {
      const parsed = Number(raw);
      if (raw === "" || Number.isNaN(parsed)) return { ...prev, stock: raw };
      return { ...prev, stock: raw, status: deriveStatus(parsed, prev.status) };
    });
    if (errors.stock) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.stock;
        return next;
      });
    }
    if (errors.status) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.status;
        return next;
      });
    }
    if (apiError) setApiError(null);
  };

  const validate = () => {
    const errs = {};

    if (!form.name.trim() || form.name.trim().length < 2)
      errs.name = "Product name must be at least 2 characters";
    else if (form.name.trim().length > 100)
      errs.name = "Product name cannot exceed 100 characters";

    if (!form.category.trim()) errs.category = "Category is required";
    else if (form.category.trim().length > 50)
      errs.category = "Category cannot exceed 50 characters";

    if (form.description.trim().length > 1000)
      errs.description = "Description cannot exceed 1000 characters";

    const price = Number(form.price);
    if (form.price === "" || Number.isNaN(price))
      errs.price = "Price is required and must be a number";
    else if (price < 0) errs.price = "Price cannot be negative";

    const stock = Number(form.stock);
    if (form.stock === "" || Number.isNaN(stock))
      errs.stock = "Stock is required and must be a whole number";
    else if (!Number.isInteger(stock))
      errs.stock = "Stock must be a whole number";
    else if (stock < 0) errs.stock = "Stock cannot be negative";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Route field-level validation failures back onto their inputs.
  const applyError = (err) => {
    const message = err.message || "An unexpected error occurred.";
    const fieldErrors = {};
    for (const detail of err.details || []) {
      if (detail?.field && detail?.message) {
        fieldErrors[detail.field] = detail.message;
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...fieldErrors }));
      if (!fieldErrors.name && !fieldErrors.description) setApiError(message);
      return;
    }
    setApiError(message);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setApiError(null);

    const stock = Number(form.stock);

    try {
      if (mode === "create") {
        await createProduct({
          name: form.name.trim(),
          category: form.category.trim(),
          price: Number(form.price),
          stock,
          status: deriveStatus(stock, form.status),
          ...(form.description.trim()
            ? { description: form.description.trim() }
            : {}),
        });
        onSaved("Product created successfully.", true);
        return;
      }

      const payload = {
        name: form.name.trim(),
        category: form.category.trim(),
        price: Number(form.price),
        stock,
        description: form.description.trim(),
      };
      // Only send status when the stock-driven derivation actually changes it:
      // an explicit status can be rejected by the backend, so a no-op write is
      // safer than re-asserting a value the server already manages.
      if (form.status !== initial.status) payload.status = form.status;

      await updateProduct(initial._id, payload);
      onSaved("Product updated successfully.", false);
    } catch (err) {
      applyError(err);
    } finally {
      setSaving(false);
    }
  };

  const statusHint =
    hasStock && stockNum === 0
      ? "Stock is 0, so this product is out of stock."
      : form.status === "out_of_stock"
        ? "Stock above 0, so out of stock is no longer available."
        : null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-xl border border-zinc-200 bg-white sm:max-w-lg sm:rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 id="product-modal-title" className="text-base font-semibold text-zinc-900">
            {mode === "create" ? "Add Product" : "Edit Product"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4 px-6 py-5">
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="p-name" label="Name" required error={errors.name}>
              <input
                id="p-name"
                ref={firstRef}
                type="text"
                value={form.name}
                onChange={set("name")}
                disabled={saving}
                placeholder="Wireless Keyboard"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "p-name-error" : undefined}
                className={inputCls(errors.name)}
              />
            </Field>

            <Field
              id="p-category"
              label="Category"
              required
              error={errors.category}
            >
              <input
                id="p-category"
                type="text"
                value={form.category}
                onChange={set("category")}
                disabled={saving}
                placeholder="Electronics"
                aria-invalid={Boolean(errors.category)}
                aria-describedby={errors.category ? "p-category-error" : undefined}
                className={inputCls(errors.category)}
              />
            </Field>

            <Field id="p-price" label="Price" required error={errors.price}>
              <input
                id="p-price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.price}
                onChange={set("price")}
                disabled={saving}
                placeholder="25000"
                aria-invalid={Boolean(errors.price)}
                aria-describedby={errors.price ? "p-price-error" : undefined}
                className={inputCls(errors.price)}
              />
            </Field>

            <Field id="p-stock" label="Stock" required error={errors.stock}>
              <input
                id="p-stock"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={form.stock}
                onChange={setStock}
                disabled={saving}
                placeholder="25"
                aria-invalid={Boolean(errors.stock)}
                aria-describedby={errors.stock ? "p-stock-error" : undefined}
                className={inputCls(errors.stock)}
              />
            </Field>
          </div>

          <Field
            id="p-description"
            label="Description"
            error={errors.description}
          >
            <textarea
              id="p-description"
              value={form.description}
              onChange={set("description")}
              disabled={saving}
              rows={3}
              placeholder="Short product description (optional)"
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description ? "p-description-error" : undefined
              }
              className={`${inputCls(errors.description)} resize-none`}
            />
          </Field>

          <Field id="p-status" label="Status" required error={errors.status}>
            <select
              id="p-status"
              value={form.status}
              onChange={set("status")}
              disabled={saving}
              aria-describedby={statusHint ? "p-status-hint" : undefined}
              className={inputCls(errors.status)}
            >
              {statusOptions.map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ))}
            </select>
            {statusHint && (
              <p id="p-status-hint" className="mt-1.5 text-xs text-zinc-500">
                {statusHint}
              </p>
            )}
          </Field>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
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
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-60"
            >
              {saving && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {saving
                ? "Saving…"
                : mode === "create"
                  ? "Add Product"
                  : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ─────────────────────────────────────────────────

function DeleteModal({ product, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteProduct(product._id);
      onDeleted();
    } catch (err) {
      setError(err.message || "Failed to delete product.");
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-delete-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6">
        <h2 id="product-delete-title" className="text-base font-semibold text-zinc-900">
          Delete Product
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Are you sure you want to delete{" "}
          <span className="font-medium text-zinc-900">{product.name}</span>?
          This action cannot be undone.
        </p>
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
            onClick={onClose}
            disabled={deleting}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:opacity-60"
          >
            {deleting && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  // List state
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);

  // Query state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);

  // Category filter options, derived from fetched products.
  const [categories, setCategories] = useState([]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // Modals
  const [modal, setModal] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type, key: Date.now() });
  }, []);

  // Load products
  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const params = { page, limit: PAGE_SIZE, sortBy, sortOrder };
      if (debouncedSearch) params.search = debouncedSearch;
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await getProducts(params);
      setProducts(res.data.products);
      setPagination(res.data.pagination);
      setCategories((prev) => {
        const next = new Set(prev);
        for (const product of res.data.products) {
          if (product.category) next.add(product.category);
        }
        return [...next].sort((a, b) => a.localeCompare(b));
      });
    } catch (err) {
      setListError(err.message || "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, categoryFilter, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    load();
  }, [load]);

  // Sorting toggle
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  // After save/delete
  const handleSaved = (message, resetPage) => {
    setModal(null);
    showToast(message, "success");
    if (resetPage) setPage(1);
    else load();
  };

  const handleDeleted = (name) => {
    setModal(null);
    showToast(`${name} was deleted.`, "success");
    if (products.length === 1 && page > 1) setPage((p) => p - 1);
    else load();
  };

  const isEmpty = !loading && !listError && products.length === 0;
  const hasFilters = Boolean(debouncedSearch || statusFilter || categoryFilter);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Products
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage your product catalog
            {pagination.total > 0 &&
              ` · ${pagination.total.toLocaleString()} total`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ type: "create" })}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Product
        </button>
      </div>

      {/* Toolbar: search + filters + sort */}
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
            placeholder="Search by name, description, or category…"
            aria-label="Search products"
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

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by category"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 lg:w-auto"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
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
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="out_of_stock">Out of Stock</option>
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
          aria-label="Sort products"
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

      {/* Content area */}
      <div className="rounded-lg border border-zinc-200 bg-white">
        {/* Loading */}
        {loading && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2.5 py-16 text-sm text-zinc-500"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Loading products…</span>
          </div>
        )}

        {/* Error */}
        {!loading && listError && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-3 font-medium text-zinc-900">
              Failed to load products
            </p>
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
              <Package className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-3 font-medium text-zinc-700">
              {hasFilters ? "No products match your filters" : "No products yet"}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {hasFilters
                ? "Try adjusting your search or filter criteria."
                : "Add your first product to get started."}
            </p>
            {!hasFilters && (
              <button
                type="button"
                onClick={() => setModal({ type: "create" })}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Product
              </button>
            )}
          </div>
        )}

        {/* Table */}
        {!loading && !listError && products.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Product list">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60">
                  {[
                    { field: "name", label: "Product" },
                    { field: "category", label: "Category" },
                    { field: "price", label: "Price", numeric: true },
                    { field: "stock", label: "Stock", numeric: true },
                    { field: "status", label: "Status" },
                  ].map(({ field, label, numeric }) => (
                    <th
                      key={field}
                      scope="col"
                      className={`px-5 py-3 ${numeric ? "text-right" : "text-left"}`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(field)}
                        className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-800 focus:outline-none ${
                          numeric ? "flex-row-reverse" : ""
                        }`}
                      >
                        {label}
                        <SortIcon
                          field={field}
                          active={sortBy === field}
                          dir={sortOrder}
                        />
                      </button>
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {products.map((p) => (
                  <tr key={p._id} className="hover:bg-zinc-50/50">
                    {/* Product */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                          <Package className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-zinc-900">
                            {p.name}
                          </p>
                          {p.description && (
                            <p className="mt-0.5 max-w-[280px] truncate text-xs text-zinc-400">
                              {p.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Category */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-zinc-600">
                        <Tags
                          className="h-3.5 w-3.5 shrink-0 text-zinc-400"
                          aria-hidden="true"
                        />
                        <span className="truncate max-w-[160px]">
                          {p.category}
                        </span>
                      </div>
                    </td>
                    {/* Price */}
                    <td className="px-5 py-3.5 text-right tabular-nums text-zinc-900">
                      {formatPrice(p.price)}
                    </td>
                    {/* Stock */}
                    <td
                      className={`px-5 py-3.5 text-right tabular-nums ${
                        p.stock === 0 ? "font-medium text-amber-700" : "text-zinc-600"
                      }`}
                    >
                      {p.stock.toLocaleString()}
                    </td>
                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <StatusBadge status={p.status} />
                    </td>
                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setModal({ type: "edit", product: p })}
                          aria-label={`Edit ${p.name}`}
                          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setModal({ type: "delete", product: p })}
                          aria-label={`Delete ${p.name}`}
                          className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
              products
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

      {/* Modals */}
      {modal?.type === "create" && (
        <ProductModal
          mode="create"
          onClose={() => setModal(null)}
          onSaved={(msg) => handleSaved(msg, true)}
        />
      )}
      {modal?.type === "edit" && (
        <ProductModal
          mode="edit"
          initial={modal.product}
          onClose={() => setModal(null)}
          onSaved={(msg) => handleSaved(msg, false)}
        />
      )}
      {modal?.type === "delete" && (
        <DeleteModal
          product={modal.product}
          onClose={() => setModal(null)}
          onDeleted={() => handleDeleted(modal.product.name)}
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
