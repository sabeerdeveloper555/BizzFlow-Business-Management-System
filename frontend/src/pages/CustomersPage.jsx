import { useEffect, useRef, useState, useCallback } from "react";
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
  Users,
  Building2,
  Phone,
  Mail,
  RefreshCw,
} from "lucide-react";
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../services/customers/customerService.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAGE_SIZE = 10;

const SORT_FIELDS = [
  { value: "createdAt", label: "Date Added" },
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "company", label: "Company" },
  { value: "status", label: "Status" },
];

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  company: "",
  address: "",
  status: "active",
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  return status === "active" ? (
    <span className="inline-flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  ) : (
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
        {required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
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

// ── Customer Form Modal ───────────────────────────────────────────────────────

function CustomerModal({ mode, initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [saving, setSaving] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    if (apiError) setApiError(null);
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim() || form.name.trim().length < 2)
      errs.name = "Name must be at least 2 characters";
    else if (form.name.trim().length > 100)
      errs.name = "Name cannot exceed 100 characters";

    if (!form.email.trim() || !EMAIL_RE.test(form.email.trim()))
      errs.email = "Please provide a valid email address";

    if (!form.phone.trim())
      errs.phone = "Phone number is required";
    else if (form.phone.trim().length > 20)
      errs.phone = "Phone number cannot exceed 20 characters";

    if (form.company && form.company.trim().length > 100)
      errs.company = "Company name cannot exceed 100 characters";

    if (form.address && form.address.trim().length > 255)
      errs.address = "Address cannot exceed 255 characters";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setApiError(null);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        company: form.company.trim() || undefined,
        address: form.address.trim() || undefined,
        status: form.status,
      };
      if (mode === "create") {
        await createCustomer(payload);
        onSaved("Customer created successfully.", true);
      } else {
        await updateCustomer(initial._id, payload);
        onSaved("Customer updated successfully.", false);
      }
    } catch (err) {
      if (err.status === 409) {
        setErrors((prev) => ({ ...prev, email: "This email is already associated with another customer." }));
      } else {
        setApiError(err.message || "An unexpected error occurred.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-xl border border-zinc-200 bg-white sm:max-w-lg sm:rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 id="modal-title" className="text-base font-semibold text-zinc-900">
            {mode === "create" ? "Add Customer" : "Edit Customer"}
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
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
              <span>{apiError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="c-name" label="Name" required error={errors.name}>
              <input
                id="c-name"
                ref={firstRef}
                type="text"
                value={form.name}
                onChange={set("name")}
                disabled={saving}
                placeholder="Jane Smith"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "c-name-error" : undefined}
                className={inputCls(errors.name)}
              />
            </Field>

            <Field id="c-email" label="Email" required error={errors.email}>
              <input
                id="c-email"
                type="email"
                value={form.email}
                onChange={set("email")}
                disabled={saving}
                placeholder="jane@example.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "c-email-error" : undefined}
                className={inputCls(errors.email)}
              />
            </Field>

            <Field id="c-phone" label="Phone" required error={errors.phone}>
              <input
                id="c-phone"
                type="tel"
                value={form.phone}
                onChange={set("phone")}
                disabled={saving}
                placeholder="+92 300 0000000"
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? "c-phone-error" : undefined}
                className={inputCls(errors.phone)}
              />
            </Field>

            <Field id="c-company" label="Company" error={errors.company}>
              <input
                id="c-company"
                type="text"
                value={form.company}
                onChange={set("company")}
                disabled={saving}
                placeholder="Acme Corp (optional)"
                className={inputCls(errors.company)}
              />
            </Field>
          </div>

          <Field id="c-address" label="Address" error={errors.address}>
            <textarea
              id="c-address"
              value={form.address}
              onChange={set("address")}
              disabled={saving}
              rows={2}
              placeholder="Street, City, Country (optional)"
              className={`${inputCls(errors.address)} resize-none`}
            />
          </Field>

          <Field id="c-status" label="Status" required>
            <select
              id="c-status"
              value={form.status}
              onChange={set("status")}
              disabled={saving}
              className={inputCls(false)}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
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
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? "Saving…" : mode === "create" ? "Add Customer" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ─────────────────────────────────────────────────

function DeleteModal({ customer, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteCustomer(customer._id);
      onDeleted();
    } catch (err) {
      setError(err.message || "Failed to delete customer.");
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6">
        <h2 id="delete-title" className="text-base font-semibold text-zinc-900">
          Delete Customer
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Are you sure you want to delete{" "}
          <span className="font-medium text-zinc-900">{customer.name}</span>?
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
            {deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  // List state
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);

  // Query state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // Modals
  const [modal, setModal] = useState(null); // null | { type: 'create' } | { type: 'edit', customer } | { type: 'delete', customer }

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type, key: Date.now() });
  }, []);

  // Load customers
  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const params = { page, limit: PAGE_SIZE, sortBy, sortOrder };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      const res = await getCustomers(params);
      setCustomers(res.data.customers);
      setPagination(res.data.pagination);
    } catch (err) {
      setListError(err.message || "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);

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
    load();
  };

  const handleDeleted = (name) => {
    setModal(null);
    showToast(`${name} was deleted.`, "success");
    if (customers.length === 1 && page > 1) setPage((p) => p - 1);
    else load();
  };

  const isEmpty = !loading && !listError && customers.length === 0;
  const hasFilters = debouncedSearch || statusFilter;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Customers</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage your customer records
            {pagination.total > 0 && ` · ${pagination.total.toLocaleString()} total`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ type: "create" })}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Customer
        </button>
      </div>

      {/* Toolbar: search + filter + sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-zinc-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, or company…"
            aria-label="Search customers"
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

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          aria-label="Filter by status"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        {/* Sort */}
        <select
          value={`${sortBy}:${sortOrder}`}
          onChange={(e) => {
            const [f, o] = e.target.value.split(":");
            setSortBy(f); setSortOrder(o); setPage(1);
          }}
          aria-label="Sort customers"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
        >
          {SORT_FIELDS.map((f) => (
            <>
              <option key={`${f.value}:asc`} value={`${f.value}:asc`}>{f.label} ↑</option>
              <option key={`${f.value}:desc`} value={`${f.value}:desc`}>{f.label} ↓</option>
            </>
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
            <span>Loading customers…</span>
          </div>
        )}

        {/* Error */}
        {!loading && listError && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-3 font-medium text-zinc-900">Failed to load customers</p>
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
              <Users className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-3 font-medium text-zinc-700">
              {hasFilters ? "No customers match your search" : "No customers yet"}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {hasFilters
                ? "Try adjusting your search or filter criteria."
                : "Add your first customer to get started."}
            </p>
            {!hasFilters && (
              <button
                type="button"
                onClick={() => setModal({ type: "create" })}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Customer
              </button>
            )}
          </div>
        )}

        {/* Table */}
        {!loading && !listError && customers.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Customer list">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60">
                  {[
                    { field: "name", label: "Customer" },
                    { field: "email", label: "Email" },
                    { field: "phone", label: "Phone" },
                    { field: "company", label: "Company" },
                    { field: "status", label: "Status" },
                  ].map(({ field, label }) => (
                    <th
                      key={field}
                      scope="col"
                      className="px-5 py-3 text-left"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(field)}
                        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-800 focus:outline-none"
                      >
                        {label}
                        <SortIcon field={field} active={sortBy === field} dir={sortOrder} />
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {customers.map((c) => (
                  <tr key={c._id} className="hover:bg-zinc-50/50">
                    {/* Customer */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600 uppercase">
                          {c.name.charAt(0)}
                        </div>
                        <span className="font-medium text-zinc-900">{c.name}</span>
                      </div>
                    </td>
                    {/* Email */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-zinc-600">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
                        <span className="truncate max-w-[180px]">{c.email}</span>
                      </div>
                    </td>
                    {/* Phone */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-zinc-600">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
                        {c.phone}
                      </div>
                    </td>
                    {/* Company */}
                    <td className="px-5 py-3.5">
                      {c.company ? (
                        <div className="flex items-center gap-1.5 text-zinc-600">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
                          <span className="truncate max-w-[140px]">{c.company}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <StatusBadge status={c.status} />
                    </td>
                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setModal({ type: "edit", customer: c })}
                          aria-label={`Edit ${c.name}`}
                          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setModal({ type: "delete", customer: c })}
                          aria-label={`Delete ${c.name}`}
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
              of <span className="font-medium text-zinc-700">{pagination.total}</span> customers
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
        <CustomerModal
          mode="create"
          onClose={() => setModal(null)}
          onSaved={(msg) => handleSaved(msg, true)}
        />
      )}
      {modal?.type === "edit" && (
        <CustomerModal
          mode="edit"
          initial={modal.customer}
          onClose={() => setModal(null)}
          onSaved={(msg) => handleSaved(msg, false)}
        />
      )}
      {modal?.type === "delete" && (
        <DeleteModal
          customer={modal.customer}
          onClose={() => setModal(null)}
          onDeleted={() => handleDeleted(modal.customer.name)}
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
