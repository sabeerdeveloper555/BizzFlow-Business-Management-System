import { Fragment, useEffect, useRef, useState, useCallback } from "react";
import { Plus, X, Pencil, Trash2, Users, Building2, Phone, Mail } from "lucide-react";
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../services/customers/customerService.js";
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
  Textarea,
} from "../components/ui/index.js";

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
    <Modal
      title={mode === "create" ? "Add Customer" : "Edit Customer"}
      titleId="customer-modal-title"
      onClose={onClose}
      size="lg"
      locked={saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="customer-form" loading={saving}>
            {saving ? "Saving…" : mode === "create" ? "Add Customer" : "Save Changes"}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {apiError && <Alert variant="danger">{apiError}</Alert>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="c-name" label="Name" required error={errors.name}>
            <Input
              id="c-name"
              ref={firstRef}
              type="text"
              value={form.name}
              onChange={set("name")}
              disabled={saving}
              placeholder="Jane Smith"
              invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "c-name-error" : undefined}
            />
          </Field>

          <Field id="c-email" label="Email" required error={errors.email}>
            <Input
              id="c-email"
              type="email"
              value={form.email}
              onChange={set("email")}
              disabled={saving}
              placeholder="jane@example.com"
              invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "c-email-error" : undefined}
            />
          </Field>

          <Field id="c-phone" label="Phone" required error={errors.phone}>
            <Input
              id="c-phone"
              type="tel"
              value={form.phone}
              onChange={set("phone")}
              disabled={saving}
              placeholder="+92 300 0000000"
              invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? "c-phone-error" : undefined}
            />
          </Field>

          <Field id="c-company" label="Company" error={errors.company}>
            <Input
              id="c-company"
              type="text"
              value={form.company}
              onChange={set("company")}
              disabled={saving}
              placeholder="Acme Corp (optional)"
              invalid={Boolean(errors.company)}
            />
          </Field>
        </div>

        <Field id="c-address" label="Address" error={errors.address}>
          <Textarea
            id="c-address"
            value={form.address}
            onChange={set("address")}
            disabled={saving}
            rows={2}
            placeholder="Street, City, Country (optional)"
            invalid={Boolean(errors.address)}
          />
        </Field>

        <Field id="c-status" label="Status" required>
          <Select id="c-status" value={form.status} onChange={set("status")} disabled={saving}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
      </form>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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

  const handleDeleted = (name) => {
    setModal(null);
    showToast(`${name} was deleted.`, "success");
    if (customers.length === 1 && page > 1) setPage((p) => p - 1);
    else load();
  };

  const runDelete = () => deleteCustomer(modal.customer._id);

  const isEmpty = !loading && !listError && customers.length === 0;
  const hasFilters = debouncedSearch || statusFilter;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description={
          <>
            Manage your customer records
            {pagination.total > 0 && ` · ${pagination.total.toLocaleString()} total`}
          </>
        }
        action={
          <Button icon={Plus} onClick={() => setModal({ type: "create" })} size="lg">
            Add Customer
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          className="flex-1"
          value={search}
          onChange={setSearch}
          onClear={() => setSearch("")}
          placeholder="Search by name, email, phone, or company…"
          label="Search customers"
        />
        <FilterSelect
          label="Filter by status"
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
          className="sm:w-auto"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </FilterSelect>
        <FilterSelect
          label="Sort customers"
          value={`${sortBy}:${sortOrder}`}
          onChange={(v) => { const [f, o] = v.split(":"); setSortBy(f); setSortOrder(o); setPage(1); }}
          className="sm:w-auto"
        >
          {SORT_FIELDS.map((f) => (
            <Fragment key={f.value}>
              <option value={`${f.value}:asc`}>{f.label} ↑</option>
              <option value={`${f.value}:desc`}>{f.label} ↓</option>
            </Fragment>
          ))}
        </FilterSelect>
      </div>

      <Card padded={false}>
        {loading && <LoadingState label="Loading customers…" />}

        {!loading && listError && (
          <ErrorState title="Failed to load customers" message={listError} onRetry={load} />
        )}

        {isEmpty && (
          <EmptyState
            icon={Users}
            title={hasFilters ? "No customers match your search" : "No customers yet"}
            description={
              hasFilters
                ? "Try adjusting your search or filter criteria."
                : "Add your first customer to get started."
            }
            action={
              !hasFilters && (
                <Button icon={Plus} onClick={() => setModal({ type: "create" })}>
                  Add Customer
                </Button>
              )
            }
          />
        )}

        {!loading && !listError && customers.length > 0 && (
          <>
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
                  {customers.map((c) => (
                    <tr key={c._id} className="hover:bg-zinc-50/50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold uppercase text-zinc-600">
                            {c.name.charAt(0)}
                          </div>
                          <span className="font-medium text-zinc-900">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-zinc-600">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
                          <span className="max-w-[180px] truncate">{c.email}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-zinc-600">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
                          {c.phone}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {c.company ? (
                          <div className="flex items-center gap-1.5 text-zinc-600">
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
                            <span className="max-w-[140px] truncate">{c.company}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton icon={Pencil} label={`Edit ${c.name}`} onClick={() => setModal({ type: "edit", customer: c })} />
                          <IconButton icon={Trash2} tone="danger" label={`Delete ${c.name}`} onClick={() => setModal({ type: "delete", customer: c })} />
                        </div>
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
                itemLabel="customers"
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </Card>

      {modal?.type === "create" && (
        <CustomerModal mode="create" onClose={() => setModal(null)} onSaved={(msg) => handleSaved(msg, true)} />
      )}
      {modal?.type === "edit" && (
        <CustomerModal mode="edit" initial={modal.customer} onClose={() => setModal(null)} onSaved={(msg) => handleSaved(msg, false)} />
      )}
      {modal?.type === "delete" && (
        <ConfirmModal
          title="Delete Customer"
          message={
            <>
              Are you sure you want to delete{" "}
              <span className="font-medium text-zinc-900">{modal.customer.name}</span>? This action cannot be undone.
            </>
          }
          confirmLabel="Delete"
          action={runDelete}
          onCancel={() => setModal(null)}
          onDone={() => handleDeleted(modal.customer.name)}
        />
      )}

      {toast && (
        <Toast key={toast.key} message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
