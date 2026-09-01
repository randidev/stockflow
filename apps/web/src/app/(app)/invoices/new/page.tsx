"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/money";

type Product = { id: string; sku: string; name: string; unitPrice: number; quantityOnHand: number };
type Line = { productId: string; quantity: number };

const TAX_RATE_PERCENT = Number(process.env.NEXT_PUBLIC_TAX_RATE_PERCENT ?? 11);

export default function NewInvoicePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ productId: "", quantity: 1 }]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ items: Product[] }>("/products?pageSize=200").then((res) => setProducts(res.items));
  }, []);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { productId: "", quantity: 1 }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const subtotal = lines.reduce((sum, l) => {
    const product = products.find((p) => p.id === l.productId);
    return sum + (product ? product.unitPrice * l.quantity : 0);
  }, 0);
  const taxAmount = Math.round((subtotal * TAX_RATE_PERCENT) / 100);
  const total = subtotal + taxAmount;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const invoice = await api<{ id: string }>("/invoices", {
        method: "POST",
        body: JSON.stringify({
          customerName,
          issueDate,
          dueDate,
          notes: notes || undefined,
          items: lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, quantity: l.quantity })),
        }),
      });
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create invoice");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold">New invoice</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded border bg-white p-4">
        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div>
          <label className="block text-sm font-medium">Customer name</label>
          <input
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Issue date</label>
            <input
              required
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Due date</label>
            <input
              required
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Line items</label>
          {lines.map((line, i) => {
            const product = products.find((p) => p.id === line.productId);
            return (
              <div key={i} className="flex items-center gap-2">
                <select
                  required
                  value={line.productId}
                  onChange={(e) => updateLine(i, { productId: e.target.value })}
                  className="flex-1 rounded border px-3 py-2 text-sm"
                >
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name} ({p.quantityOnHand} in stock)
                    </option>
                  ))}
                </select>
                <input
                  required
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                  className="w-20 rounded border px-3 py-2 text-sm"
                />
                <span className="w-28 text-right text-sm text-zinc-600">
                  {product ? formatMoney(product.unitPrice * line.quantity) : "-"}
                </span>
                <button type="button" onClick={() => removeLine(i)} className="text-sm text-red-600">
                  Remove
                </button>
              </div>
            );
          })}
          <button type="button" onClick={addLine} className="text-sm font-medium text-zinc-900 underline">
            + Add line
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">Subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Tax ({TAX_RATE_PERCENT}%)</span>
            <span>{formatMoney(taxAmount)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>
          <p className="pt-1 text-xs text-zinc-400">Final totals are calculated by the server on save.</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save as draft"}
        </button>
      </form>
    </div>
  );
}
