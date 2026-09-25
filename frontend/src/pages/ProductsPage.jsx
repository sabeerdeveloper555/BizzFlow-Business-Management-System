import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Package, Tags } from "lucide-react";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../services/products/productService.js";
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

function StatusBadge({ status }) {
  if (status === "active") {
    return (
      <Badge tone="success" dot>
        Active
      </Badge>
    );
  }
  if (status === "out_of_stock") {
    return (
      <Badge tone="danger" dot>
        Out of Stock
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" dot>
      Inactive
    </Badge>
  );
}

// ── Product Form Modal ────────────────────────────────────────────────────────

function ProductModal({ mode, initial, onClose, onSaved }) {
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

  const stockNum = Number(form.stock);
  const hasStock = form.stock !== "" && !Number.isNaN(stockNum);

  const statusOptions = useMemo(() => {
    if (hasStock && stockNum === 0) return ["out_of_stock"];
    return ["active", "inactive"];
  }, [hasStock, stockNum]);

  const set = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    if (apiError) setApiError(null);
  };

  const setStock = (e) => {
    const raw = e.target.value;
    setForm((prev) => {
      const parsed = Number(raw);
      if (raw === "" || Number.isNaN(parsed)) return { ...prev, stock: raw };
      return { ...prev, stock: raw, status: deriveStatus(parsed, prev.status) };
    });
    if (errors.stock) setErrors((prev) => { const n = { ...prev }; delete n.stock; return n; });
    if (errors.status) setErrors((prev) => { const n = { ...prev }; delete n.status; return n; });
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
    <Modal
      title={mode === "create" ? "Add Product" : "Edit Product"}
      titleId="product-modal-title"
      onClose={onClose}
      size="lg"
      locked={saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" loading={saving}>
            {saving ? "Saving…" : mode === "create" ? "Add Product" : "Save Changes"}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {apiError && <Alert variant="danger">{apiError}</Alert>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="p-name" label="Name" required error={errors.name}>
            <Input
              id="p-name"
              ref={firstRef}
              type="text"
              value={form.name}
              onChange={set("name")}
              disabled={saving}
              placeholder="Wireless Keyboard"
              invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "p-name-error" : undefined}
            />
          </Field>

          <Field id="p-category" label="Category" required error={errors.category}>
            <Input
              id="p-category"
              type="text"
              value={form.category}
              onChange={set("category")}
              disabled={saving}
              placeholder="Electronics"
              invalid={Boolean(errors.category)}
              aria-describedby={errors.category ? "p-category-error" : undefined}
            />
          </Field>

          <Field id="p-price" label="Price" required error={errors.price}>
            <Input
              id="p-price"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.price}
              onChange={set("price")}
              disabled={saving}
              placeholder="25000"
              invalid={Boolean(errors.price)}
              aria-describedby={errors.price ? "p-price-error" : undefined}
            />
          </Field>

          <Field id="p-stock" label="Stock" required error={errors.stock}>
            <Input
              id="p-stock"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={form.stock}
              onChange={setStock}
              disabled={saving}
              placeholder="25"
              invalid={Boolean(errors.stock)}
              aria-describedby={errors.stock ? "p-stock-error" : undefined}
            />
          </Field>
        </div>

        <Field id="p-description" label="Description" error={errors.description}>
          <Textarea
            id="p-description"
            value={form.description}
            onChange={set("description")}
            disabled={saving}
            rows={3}
            placeholder="Short product description (optional)"
            invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? "p-description-error" : undefined}
          />
        </Field>

        <Field id="p-status" label="Status" required error={errors.status} hint={statusHint || undefined}>
          <Select
            id="p-status"
            value={form.status}
            onChange={set("status")}
            disabled={saving}
            aria-describedby={statusHint ? "p-status-hint" : undefined}
          >
            {statusOptions.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useState([]);

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

  useEffect(() => { load(); }, [load]);

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortOrder("asc"); }
    setPage(1);
  };

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

  const runDelete = () => deleteProduct(modal.product._id);

  const isEmpty = !loading && !listError && products.length === 0;
  const hasFilters = Boolean(debouncedSearch || statusFilter || categoryFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description={
          <>
            Manage your product catalog
            {pagination.total > 0 && ` · ${pagination.total.toLocaleString()} total`}
          </>
        }
        action={
          <Button icon={Plus} size="lg" onClick={() => setModal({ type: "create" })}>
            Add Product
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          className="flex-1"
          value={search}
          onChange={setSearch}
          onClear={() => setSearch("")}
          placeholder="Search by name, description, or category…"
          label="Search products"
        />
        <FilterSelect label="Filter by category" value={categoryFilter} onChange={(v) => { setCategoryFilter(v); setPage(1); }}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </FilterSelect>
        <FilterSelect label="Filter by status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="out_of_stock">Out of Stock</option>
        </FilterSelect>
        <FilterSelect
          label="Sort products"
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
        {loading && <LoadingState label="Loading products…" />}

        {!loading && listError && (
          <ErrorState title="Failed to load products" message={listError} onRetry={load} />
        )}

        {isEmpty && (
          <EmptyState
            icon={Package}
            title={hasFilters ? "No products match your filters" : "No products yet"}
            description={
              hasFilters
                ? "Try adjusting your search or filter criteria."
                : "Add your first product to get started."
            }
            action={
              !hasFilters && (
                <Button icon={Plus} onClick={() => setModal({ type: "create" })}>
                  Add Product
                </Button>
              )
            }
          />
        )}

        {!loading && !listError && products.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Product list">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/60">
                    <SortHeader label="Product" field="name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                    <SortHeader label="Category" field="category" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                    <SortHeader label="Price" field="price" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} numeric />
                    <SortHeader label="Stock" field="stock" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} numeric />
                    <SortHeader label="Status" field="status" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                    <th scope="col" className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {products.map((p) => (
                    <tr key={p._id} className="hover:bg-zinc-50/50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                            <Package className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-zinc-900">{p.name}</p>
                            {p.description && (
                              <p className="mt-0.5 max-w-[280px] truncate text-xs text-zinc-400">{p.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-zinc-600">
                          <Tags className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
                          <span className="max-w-[160px] truncate">{p.category}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-zinc-900">{formatPrice(p.price)}</td>
                      <td className={`px-5 py-3.5 text-right tabular-nums ${p.stock === 0 ? "font-medium text-red-600" : "text-zinc-600"}`}>
                        {p.stock.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton icon={Pencil} label={`Edit ${p.name}`} onClick={() => setModal({ type: "edit", product: p })} />
                          <IconButton icon={Trash2} tone="danger" label={`Delete ${p.name}`} onClick={() => setModal({ type: "delete", product: p })} />
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
                itemLabel="products"
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </Card>

      {modal?.type === "create" && (
        <ProductModal mode="create" onClose={() => setModal(null)} onSaved={(msg) => handleSaved(msg, true)} />
      )}
      {modal?.type === "edit" && (
        <ProductModal mode="edit" initial={modal.product} onClose={() => setModal(null)} onSaved={(msg) => handleSaved(msg, false)} />
      )}
      {modal?.type === "delete" && (
        <ConfirmModal
          title="Delete Product"
          message={
            <>
              Are you sure you want to delete{" "}
              <span className="font-medium text-zinc-900">{modal.product.name}</span>? This action cannot be undone.
            </>
          }
          confirmLabel="Delete"
          action={runDelete}
          onCancel={() => setModal(null)}
          onDone={() => handleDeleted(modal.product.name)}
        />
      )}

      {toast && (
        <Toast key={toast.key} message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
