import { useEffect, useRef, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Users, Mail, Power, PowerOff } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  getUsers,
  createStaff,
  updateUser,
  updateUserStatus,
  deleteUser,
} from "../services/users/userService.js";
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
  SortHeader,
  Pagination,
  IconButton,
  LoadingState,
  Field,
  Input,
  Select,
} from "../components/ui/index.js";

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

function RoleBadge({ role }) {
  return role === "admin" ? (
    <Badge tone="strong">Administrator</Badge>
  ) : (
    <Badge tone="neutral">Staff</Badge>
  );
}

function StatusBadge({ status }) {
  return status === "active" ? (
    <Badge tone="success" dot>
      Active
    </Badge>
  ) : (
    <Badge tone="neutral" dot>
      Inactive
    </Badge>
  );
}

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

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    if (apiError) setApiError(null);
  };

  const validate = () => {
    const errs = {};
    const name = form.name.trim();

    if (!name || name.length < 2) errs.name = "Name must be at least 2 characters";
    else if (name.length > 50) errs.name = "Name cannot exceed 50 characters";

    if (!form.email.trim() || !EMAIL_RE.test(form.email.trim()))
      errs.email = "Please provide a valid email address";

    if (!isEdit) {
      if (!form.password || form.password.length < 6)
        errs.password = "Password must be at least 6 characters";
    } else if (form.password && form.password.length < 6) {
      errs.password = "Password must be at least 6 characters";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const applyError = (err) => {
    const message = err.message || "An unexpected error occurred.";
    if (err.status === 409) {
      setErrors((prev) => ({ ...prev, email: message }));
      return;
    }
    const fieldErrors = {};
    for (const detail of err.details || []) {
      if (detail?.field && detail?.message) fieldErrors[detail.field] = detail.message;
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
        await createStaff({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        });
        onSaved("Staff user created successfully", true);
        return;
      }

      const payload = { name: form.name.trim(), email: form.email.trim() };
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
    <Modal
      title={isEdit ? "Edit Staff" : "Add Staff"}
      titleId="staff-modal-title"
      onClose={onClose}
      size="lg"
      locked={saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="staff-form" loading={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Staff"}
          </Button>
        </>
      }
    >
      <form id="staff-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {apiError && <Alert variant="danger">{apiError}</Alert>}

        {isEdit && (
          <p className="text-sm text-zinc-500">
            Role: <span className="font-medium text-zinc-800">Staff</span>
          </p>
        )}

        <Field id="s-name" label="Name" required error={errors.name}>
          <Input
            id="s-name"
            ref={firstRef}
            type="text"
            value={form.name}
            onChange={set("name")}
            disabled={saving}
            placeholder="Jane Smith"
            invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "s-name-error" : undefined}
          />
        </Field>

        <Field id="s-email" label="Email" required error={errors.email}>
          <Input
            id="s-email"
            type="email"
            value={form.email}
            onChange={set("email")}
            disabled={saving}
            placeholder="jane@example.com"
            invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "s-email-error" : undefined}
          />
        </Field>

        <Field
          id="s-password"
          label="Password"
          required={!isEdit}
          error={errors.password}
          hint={isEdit ? "Leave blank to keep the current password." : undefined}
        >
          <Input
            id="s-password"
            type="password"
            value={form.password}
            onChange={set("password")}
            disabled={saving}
            autoComplete="new-password"
            placeholder={isEdit ? "••••••••" : "Minimum 6 characters"}
            invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? "s-password-error" : isEdit ? "s-password-hint" : undefined
            }
          />
        </Field>

        {isEdit && (
          <Field id="s-status" label="Status" required>
            <Select id="s-status" value={form.status} onChange={set("status")} disabled={saving}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
        )}
      </form>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id;

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const [modal, setModal] = useState(null);

  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type, key: Date.now() });
  }, []);

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

  useEffect(() => { load(); }, [load]);

  // A staff row is manageable only if it is not an administrator and not the
  // currently signed-in admin's own record.
  const canManage = (row) => row.role !== "admin" && row._id !== currentUserId;

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortOrder("asc"); }
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

  const runDeactivate = () => updateUserStatus(modal.user._id, "inactive");
  const runDelete = () => deleteUser(modal.user._id);

  const isEmpty = !loading && !listError && users.length === 0;
  const hasFilters = Boolean(debouncedSearch || statusFilter || roleFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description={
          <>
            Manage staff user accounts
            {pagination.total > 0 && ` · ${pagination.total.toLocaleString()} total`}
          </>
        }
        action={
          <Button icon={Plus} size="lg" onClick={() => setModal({ type: "create" })}>
            Add Staff
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          className="flex-1"
          value={search}
          onChange={setSearch}
          onClear={() => setSearch("")}
          placeholder="Search by staff name or email..."
          label="Search staff"
        />
        <FilterSelect label="Filter by role" value={roleFilter} onChange={(v) => { setRoleFilter(v); setPage(1); }}>
          <option value="">All Roles</option>
          <option value="admin">Administrator</option>
          <option value="staff">Staff</option>
        </FilterSelect>
        <FilterSelect label="Filter by status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </FilterSelect>
        <FilterSelect
          label="Sort staff"
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

      <Card padded={false}>
        {loading && <LoadingState label="Loading staff…" />}

        {!loading && listError && (
          <ErrorState title="Failed to load staff" message={listError} onRetry={load} />
        )}

        {isEmpty && (
          <EmptyState
            icon={Users}
            title={hasFilters ? "No staff users match your filters." : "No staff users yet"}
            description={!hasFilters ? "Add your first staff member to get started." : undefined}
            action={
              !hasFilters && (
                <Button icon={Plus} onClick={() => setModal({ type: "create" })}>
                  Add Staff
                </Button>
              )
            }
          />
        )}

        {!loading && !listError && users.length > 0 && (
          <>
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
                      <SortHeader
                        key={field}
                        label={label}
                        field={field}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                      />
                    ))}
                    <th scope="col" className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {users.map((u) => (
                    <tr key={u._id} className="hover:bg-zinc-50/50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold uppercase text-zinc-600">
                            {(u.name || "?").charAt(0)}
                          </div>
                          <span className="font-medium text-zinc-900">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-zinc-600">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
                          <span className="max-w-[220px] truncate">{u.email}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-zinc-600">
                        {formatDateTime(u.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {canManage(u) ? (
                          <div className="flex items-center justify-end gap-1">
                            <IconButton icon={Pencil} label={`Edit ${u.name}`} onClick={() => setModal({ type: "edit", user: u })} />
                            {u.status === "active" ? (
                              <IconButton
                                icon={PowerOff}
                                tone="warning"
                                label={`Deactivate ${u.name}`}
                                onClick={() => setModal({ type: "deactivate", user: u })}
                              />
                            ) : (
                              <IconButton
                                icon={Power}
                                tone="success"
                                label={`Activate ${u.name}`}
                                onClick={() => handleActivate(u)}
                              />
                            )}
                            <IconButton
                              icon={Trash2}
                              tone="danger"
                              label={`Delete ${u.name}`}
                              onClick={() => setModal({ type: "delete", user: u })}
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400">
                            {u.role === "admin" ? "Administrator — managed outside Staff" : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 0 && (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={pagination.total}
                totalPages={pagination.totalPages}
                itemLabel="staff"
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </Card>

      {modal?.type === "create" && (
        <StaffModal mode="create" onClose={() => setModal(null)} onSaved={(msg) => handleSaved(msg, true)} />
      )}
      {modal?.type === "edit" && (
        <StaffModal mode="edit" initial={modal.user} onClose={() => setModal(null)} onSaved={(msg) => handleSaved(msg, false)} />
      )}
      {modal?.type === "deactivate" && (
        <ConfirmModal
          title="Deactivate Staff"
          tone="warning"
          confirmLabel="Deactivate"
          message={
            <>
              Deactivating <span className="font-medium text-zinc-900">{modal.user.name}</span> will immediately
              prevent this account from signing in to BizFlow. They can be reactivated later.
            </>
          }
          action={runDeactivate}
          onCancel={() => setModal(null)}
          onDone={() => handleStatusChanged("Staff user deactivated")}
        />
      )}
      {modal?.type === "delete" && (
        <ConfirmModal
          title="Delete Staff"
          confirmLabel="Delete"
          message={
            <>
              This permanently deletes the staff account for{" "}
              <span className="font-medium text-zinc-900">{modal.user.name}</span>. This action cannot be undone.
            </>
          }
          action={runDelete}
          onCancel={() => setModal(null)}
          onDone={handleDeleted}
        />
      )}

      {toast && (
        <Toast key={toast.key} message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
