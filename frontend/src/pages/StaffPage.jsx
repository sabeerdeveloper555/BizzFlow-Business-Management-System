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
  Mail,
  Power,
  PowerOff,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  getUsers,
  createStaff,
  updateUser,
  updateUserStatus,
  deleteUser,
} from "../services/users/userService.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAGE_SIZE = 10;

// Only fields the backend list endpoint actually supports for sorting.
const SORT_FIELDS = [
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "role", label: "Role" },
  { value: "status", label: "Status" },
  { value: "createdAt", label: "Created At" },
  { value: "updatedAt", label: "Updated At" },
];

const ROLE_LABELS = {
  admin: "Administrator",
  staff: "Staff",
};

// Canonical default so form fields are always strings, even when a returned
// user is missing one (e.g. password is never sent back by the API).
const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  status: "active",
};

const toFormValues = (user) =>
  Object.fromEntries(
    Object.entries(EMPTY_FORM).map(([field, fallback]) => {
      const value = user[field];
      return [
        field,
        value === undefined || value === null ? fallback : String(value),
      ];
    }),
  );

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

// ── Small helpers ─────────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center rounded border border-zinc-300 bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">
        Administrator
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-600">
      Staff
    </span>
  );
}

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

function Field({ id, label, error, required, hint, children }) {
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
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-zinc-500">
          {hint}
        </p>
      )}
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

// ── Staff Form Modal (create / edit) ──────────────────────────────────────────

function StaffModal({ mode, initial, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState(() =>
    initial ? toFormValues(initial) : { ...EMPTY_FORM },
  );
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [saving, setSaving] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (apiError) setApiError(null);
  };

  const validate = () => {
    const errs = {};
    const name = form.name.trim();

    if (!name || name.length < 2) errs.name = "Name must be at least 2 characters";
    else if (name.length > 50) errs.name = "Name cannot exceed 50 characters";

    if (!form.email.trim() || !EMAIL_RE.test(form.email.trim()))
      errs.email = "Please provide a valid email address";

    // Password is required when creating, optional when editing. A provided
    // password must always meet the backend minimum.
    if (!isEdit) {
      if (!form.password || form.password.length < 6)
        errs.password = "Password must be at least 6 characters";
    } else if (form.password && form.password.length < 6) {
      errs.password = "Password must be at least 6 characters";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Route field-level backend validation onto the matching inputs; use the
  // backend message verbatim rather than inventing our own.
  const applyError = (err) => {
    const message = err.message || "An unexpected error occurred.";
    if (err.status === 409) {
      setErrors((prev) => ({ ...prev, email: message }));
      return;
    }
    const fieldErrors = {};
    for (const detail of err.details || []) {
      if (detail?.field && detail?.message) {
        fieldErrors[detail.field] = detail.message;
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...fieldErrors }));
      return;
    }
    setApiError(message);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setApiError(null);
    try {
      if (!isEdit) {
        // Create: role/status are intentionally omitted — backend forces
        // staff + active.
        await createStaff({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        });
        onSaved("Staff user created successfully", true);
        return;
      }

      const payload = { name: form.name.trim(), email: form.email.trim() };
      // Only send optional mutations that actually changed, and never send a
      // blank password.
      if (form.password) payload.password = form.password;
      if (form.status !== initial.status) payload.status = form.status;

      await updateUser(initial._id, payload);
      onSaved("Staff user updated successfully", false);
    } catch (err) {
      applyError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-xl border border-zinc-200 bg-white sm:max-w-lg sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 id="staff-modal-title" className="text-base font-semibold text-zinc-900">
            {isEdit ? "Edit Staff" : "Add Staff"}
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

          {isEdit && (
            <p className="text-sm text-zinc-500">
              Role: <span className="font-medium text-zinc-800">Staff</span>
            </p>
          )}

          <Field id="s-name" label="Name" required error={errors.name}>
            <input
              id="s-name"
              ref={firstRef}
              type="text"
              value={form.name}
              onChange={set("name")}
              disabled={saving}
              placeholder="Jane Smith"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "s-name-error" : undefined}
              className={inputCls(errors.name)}
            />
          </Field>

          <Field id="s-email" label="Email" required error={errors.email}>
            <input
              id="s-email"
              type="email"
              value={form.email}
              onChange={set("email")}
              disabled={saving}
              placeholder="jane@example.com"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "s-email-error" : undefined}
              className={inputCls(errors.email)}
            />
          </Field>

          <Field
            id="s-password"
            label="Password"
            required={!isEdit}
            error={errors.password}
            hint={isEdit ? "Leave blank to keep the current password." : undefined}
          >
            <input
              id="s-password"
              type="password"
              value={form.password}
              onChange={set("password")}
              disabled={saving}
              autoComplete="new-password"
              placeholder={isEdit ? "••••••••" : "Minimum 6 characters"}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password
                  ? "s-password-error"
                  : isEdit
                    ? "s-password-hint"
                    : undefined
              }
              className={inputCls(errors.password)}
            />
          </Field>

          {isEdit && (
            <Field id="s-status" label="Status" required>
              <select
                id="s-status"
                value={form.status}
                onChange={set("status")}
                disabled={saving}
                className={inputCls(false)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          )}

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
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Staff"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Deactivate Confirmation Modal ─────────────────────────────────────────────

function DeactivateModal({ user, onClose, onConfirmed }) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setWorking(true);
    setError(null);
    try {
      await updateUserStatus(user._id, "inactive");
      onConfirmed();
    } catch (err) {
      setError(err.message || "Failed to deactivate staff user.");
      setWorking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deactivate-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !working) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6">
        <h2 id="deactivate-title" className="text-base font-semibold text-zinc-900">
          Deactivate Staff
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Deactivating{" "}
          <span className="font-medium text-zinc-900">{user.name}</span> will
          immediately prevent this account from signing in to BizFlow. They can
          be reactivated later.
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
            disabled={working}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={working}
            className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2 disabled:opacity-60"
          >
            {working && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {working ? "Deactivating…" : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal (hard delete) ───────────────────────────────────

function DeleteModal({ user, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteUser(user._id);
      onDeleted();
    } catch (err) {
      setError(err.message || "Failed to delete staff user.");
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6">
        <h2 id="delete-title" className="text-base font-semibold text-zinc-900">
          Delete Staff
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          This permanently deletes the staff account for{" "}
          <span className="font-medium text-zinc-900">{user.name}</span>. This
          action cannot be undone.
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

export default function StaffPage() {
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id;

  // List state
  const [users, setUsers] = useState([]);
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
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);

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

  // Load users
  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const params = { page, limit: PAGE_SIZE, sortBy, sortOrder };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (roleFilter) params.role = roleFilter;
      const res = await getUsers(params);
      setUsers(res.data.users);
      setPagination(res.data.pagination);
    } catch (err) {
      setListError(err.message || "Failed to load staff users.");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, roleFilter, sortBy, sortOrder]);

  useEffect(() => {
    load();
  }, [load]);

  // A staff row is manageable only if it is not an administrator and not the
  // currently signed-in admin's own record.
  const canManage = (row) =>
    row.role !== "admin" && row._id !== currentUserId;

  // Sorting toggle via column headers
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const handleSaved = (message, resetPage) => {
    setModal(null);
    showToast(message, "success");
    if (resetPage) setPage(1);
    load();
  };

  const handleStatusChanged = (message) => {
    setModal(null);
    showToast(message, "success");
    load();
  };

  const handleActivate = async (row) => {
    try {
      await updateUserStatus(row._id, "active");
      showToast("Staff user activated", "success");
      load();
    } catch (err) {
      showToast(err.message || "Failed to activate staff user.", "error");
    }
  };

  const handleDeleted = () => {
    setModal(null);
    showToast("Staff user deleted successfully", "success");
    if (users.length === 1 && page > 1) setPage((p) => p - 1);
    else load();
  };

  const isEmpty = !loading && !listError && users.length === 0;
  const hasFilters = Boolean(debouncedSearch || statusFilter || roleFilter);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Staff
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage staff user accounts
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
          Add Staff
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
            placeholder="Search by staff name or email..."
            aria-label="Search staff"
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

        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by role"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 lg:w-auto"
        >
          <option value="">All Roles</option>
          <option value="admin">Administrator</option>
          <option value="staff">Staff</option>
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
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
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
          aria-label="Sort staff"
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
            <span>Loading staff…</span>
          </div>
        )}

        {/* Error */}
        {!loading && listError && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-3 font-medium text-zinc-900">
              Failed to load staff
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
              <Users className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-3 font-medium text-zinc-700">
              {hasFilters
                ? "No staff users match your filters."
                : "No staff users yet"}
            </p>
            {!hasFilters && (
              <>
                <p className="mt-1 text-sm text-zinc-400">
                  Add your first staff member to get started.
                </p>
                <button
                  type="button"
                  onClick={() => setModal({ type: "create" })}
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add Staff
                </button>
              </>
            )}
          </div>
        )}

        {/* Table */}
        {!loading && !listError && users.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Staff list">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60">
                  {[
                    { field: "name", label: "Name" },
                    { field: "email", label: "Email" },
                    { field: "role", label: "Role" },
                    { field: "status", label: "Status" },
                    { field: "createdAt", label: "Created At" },
                  ].map(({ field, label }) => (
                    <th key={field} scope="col" className="px-5 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => handleSort(field)}
                        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-800 focus:outline-none"
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
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-zinc-50/50">
                    {/* Name */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold uppercase text-zinc-600">
                          {(u.name || "?").charAt(0)}
                        </div>
                        <span className="font-medium text-zinc-900">
                          {u.name}
                        </span>
                      </div>
                    </td>
                    {/* Email */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-zinc-600">
                        <Mail
                          className="h-3.5 w-3.5 shrink-0 text-zinc-400"
                          aria-hidden="true"
                        />
                        <span className="max-w-[220px] truncate">{u.email}</span>
                      </div>
                    </td>
                    {/* Role */}
                    <td className="px-5 py-3.5">
                      <RoleBadge role={u.role} />
                    </td>
                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <StatusBadge status={u.status} />
                    </td>
                    {/* Created At */}
                    <td className="whitespace-nowrap px-5 py-3.5 text-zinc-600">
                      {formatDateTime(u.createdAt)}
                    </td>
                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      {canManage(u) ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setModal({ type: "edit", user: u })}
                            aria-label={`Edit ${u.name}`}
                            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {u.status === "active" ? (
                            <button
                              type="button"
                              onClick={() =>
                                setModal({ type: "deactivate", user: u })
                              }
                              aria-label={`Deactivate ${u.name}`}
                              className="rounded p-1.5 text-zinc-400 hover:bg-amber-50 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-600"
                            >
                              <PowerOff className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleActivate(u)}
                              aria-label={`Activate ${u.name}`}
                              className="rounded p-1.5 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            >
                              <Power className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setModal({ type: "delete", user: u })}
                            aria-label={`Delete ${u.name}`}
                            className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400">
                          {u.role === "admin"
                            ? "Administrator — managed outside Staff"
                            : "—"}
                        </span>
                      )}
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
              staff
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
        <StaffModal
          mode="create"
          onClose={() => setModal(null)}
          onSaved={(msg) => handleSaved(msg, true)}
        />
      )}
      {modal?.type === "edit" && (
        <StaffModal
          mode="edit"
          initial={modal.user}
          onClose={() => setModal(null)}
          onSaved={(msg) => handleSaved(msg, false)}
        />
      )}
      {modal?.type === "deactivate" && (
        <DeactivateModal
          user={modal.user}
          onClose={() => setModal(null)}
          onConfirmed={() => handleStatusChanged("Staff user deactivated")}
        />
      )}
      {modal?.type === "delete" && (
        <DeleteModal
          user={modal.user}
          onClose={() => setModal(null)}
          onDeleted={handleDeleted}
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
