"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, fieldErrors } from "@/lib/api";
import { formatMoney } from "@/lib/money";

type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unitPrice: number;
  quantityOnHand: number;
};

type FormState = { sku: string; name: string; description: string; unitPrice: string; quantityOnHand: string };

const emptyForm: FormState = { sku: "", name: "", description: "", unitPrice: "", quantityOnHand: "" };

function stockClass(qty: number) {
  if (qty === 0) return "text-danger";
  if (qty <= 10) return "text-warn";
  return "text-ink";
}

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set("search", search);
      const res = await api<{ items: Product[]; total: number }>(`/products?${params}`);
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setFormErrors({});
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      sku: p.sku,
      name: p.name,
      description: p.description ?? "",
      unitPrice: String(p.unitPrice / 100),
      quantityOnHand: String(p.quantityOnHand),
    });
    setFormError(null);
    setFormErrors({});
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormErrors({});
    const payload = {
      sku: form.sku,
      name: form.name,
      description: form.description || undefined,
      unitPrice: Math.round(Number(form.unitPrice) * 100),
      quantityOnHand: Number(form.quantityOnHand),
    };
    try {
      if (editingId) {
        await api(`/products/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api("/products", { method: "POST", body: JSON.stringify(payload) });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save product");
      setFormErrors(fieldErrors(err));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    try {
      await api(`/products/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to delete product");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Products</h1>
          <p className="text-sm text-ink-2">{total} in your catalog</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          New product
        </button>
      </div>

      <input
        aria-label="Search by name or SKU"
        placeholder="Search by name or SKU"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="input max-w-sm"
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-4 p-5">
          <h2 className="text-sm font-semibold text-ink">{editingId ? "Edit product" : "New product"}</h2>
          {formError && <p className="banner-danger">{formError}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sku" className="label">SKU</label>
              <input
                id="sku"
                required
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="input"
              />
              {formErrors.sku && <p className="mt-1 text-xs text-danger">{formErrors.sku}</p>}
            </div>
            <div>
              <label htmlFor="name" className="label">Name</label>
              <input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
              />
              {formErrors.name && <p className="mt-1 text-xs text-danger">{formErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="unitPrice" className="label">Unit price</label>
              <input
                id="unitPrice"
                required
                type="number"
                min="0"
                step="0.01"
                value={form.unitPrice}
                onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                className="input"
              />
              {formErrors.unitPrice && <p className="mt-1 text-xs text-danger">{formErrors.unitPrice}</p>}
            </div>
            <div>
              <label htmlFor="quantityOnHand" className="label">Quantity on hand</label>
              <input
                id="quantityOnHand"
                required
                type="number"
                min="0"
                step="1"
                value={form.quantityOnHand}
                onChange={(e) => setForm({ ...form, quantityOnHand: e.target.value })}
                className="input"
              />
              {formErrors.quantityOnHand && <p className="mt-1 text-xs text-danger">{formErrors.quantityOnHand}</p>}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="description" className="label">Description</label>
              <input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn-primary">
              Save
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && <p className="text-sm text-ink-2">Loading products...</p>}
      {error && <p className="banner-danger">{error}</p>}

      {!loading && !error && (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Price</th>
                <th>On hand</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-ink-2">
                    No products found.
                  </td>
                </tr>
              )}
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs text-ink-2">{p.sku}</td>
                  <td className="font-medium text-ink">{p.name}</td>
                  <td className="text-ink">{formatMoney(p.unitPrice)}</td>
                  <td className={`font-medium ${stockClass(p.quantityOnHand)}`}>{p.quantityOnHand}</td>
                  <td className="text-right">
                    <button onClick={() => openEdit(p)} className="btn-ghost">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="btn-ghost-danger">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-2">
          Page {page} of {totalPages} ({total} total)
        </span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary">
            Previous
          </button>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
