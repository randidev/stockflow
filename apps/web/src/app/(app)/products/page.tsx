"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
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

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

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
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Products</h1>
        <button onClick={openCreate} className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white">
          New product
        </button>
      </div>

      <input
        placeholder="Search by name or SKU"
        value={search}
        onChange={(e) => {
          setPage(1);
          setSearch(e.target.value);
        }}
        className="w-full max-w-sm rounded border px-3 py-2 text-sm"
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded border bg-white p-4">
          {formError && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium">SKU</label>
              <input
                required
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Unit price</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.unitPrice}
                onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Quantity on hand</label>
              <input
                required
                type="number"
                min="0"
                step="1"
                value={form.quantityOnHand}
                onChange={(e) => setForm({ ...form, quantityOnHand: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white">
              Save
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded border px-3 py-1.5 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && <p className="text-sm text-zinc-500">Loading products...</p>}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">On hand</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                    No products found.
                  </td>
                </tr>
              )}
              {items.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{p.sku}</td>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2">{formatMoney(p.unitPrice)}</td>
                  <td className="px-3 py-2">{p.quantityOnHand}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => openEdit(p)} className="mr-3 text-zinc-600 hover:text-zinc-900">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-800">
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
        <span className="text-zinc-500">
          Page {page} of {totalPages} ({total} total)
        </span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-3 py-1 disabled:opacity-40">
            Previous
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
