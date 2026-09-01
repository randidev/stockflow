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
    <div className="max-w-2xl space-y-5">
      <h1 className="text-lg font-semibold text-ink">New invoice</h1>

      <form onSubmit={handleSubmit} className="card space-y-5 p-6">
        {error && <p className="banner-danger">{error}</p>}

        <div>
          <label className="label">Customer name</label>
          <input required value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Issue date</label>
            <input required type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Due date</label>
            <input required type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="label mb-0">Line items</label>
          <div className="space-y-2">
            {lines.map((line, i) => {
              const product = products.find((p) => p.id === line.productId);
              return (
                <div key={i} className="flex items-center gap-2">
                  <select
                    required
                    value={line.productId}
                    onChange={(e) => updateLine(i, { productId: e.target.value })}
                    className="input flex-1"
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
                    className="input w-20 shrink-0"
                  />
                  <span className="w-28 shrink-0 text-right text-sm tabular-nums text-ink-2">
                    {product ? formatMoney(product.unitPrice * line.quantity) : "—"}
                  </span>
                  <button type="button" onClick={() => removeLine(i)} className="btn-ghost-danger shrink-0">
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={addLine} className="link text-sm">
            + Add line
          </button>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={3} />
        </div>

        <div className="space-y-1.5 border-t border-border pt-4 text-sm">
          <div className="flex justify-between text-ink-2">
            <span>Subtotal</span>
            <span className="tabular-nums text-ink">{formatMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between text-ink-2">
            <span>Tax ({TAX_RATE_PERCENT}%)</span>
            <span className="tabular-nums text-ink">{formatMoney(taxAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold text-ink">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(total)}</span>
          </div>
          <p className="pt-1 text-xs text-ink-2">Final totals are calculated by the server on save.</p>
        </div>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : "Save as draft"}
        </button>
      </form>
    </div>
  );
}
