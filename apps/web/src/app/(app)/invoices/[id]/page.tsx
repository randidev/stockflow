"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/money";

type InvoiceItem = { id: string; productName: string; unitPrice: number; quantity: number; lineTotal: number };
type Invoice = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  status: "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";
  issueDate: string;
  dueDate: string;
  notes: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  items: InvoiceItem[];
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    api<Invoice>(`/invoices/${id}`)
      .then(setInvoice)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load invoice"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function runAction(action: "issue" | "pay" | "cancel") {
    setActionError(null);
    setActionLoading(true);
    try {
      await api(`/invoices/${id}/${action}`, { method: "POST" });
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading invoice...</p>;
  if (error) return <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!invoice) return null;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{invoice.invoiceNumber}</h1>
          <p className="text-sm text-zinc-500">{invoice.customerName}</p>
        </div>
        <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium">{invoice.status}</span>
      </div>

      {actionError && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}

      <div className="flex gap-2">
        {invoice.status === "DRAFT" && (
          <>
            <button
              disabled={actionLoading}
              onClick={() => runAction("issue")}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Issue
            </button>
            <button
              disabled={actionLoading}
              onClick={() => runAction("cancel")}
              className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        )}
        {invoice.status === "ISSUED" && (
          <>
            <button
              disabled={actionLoading}
              onClick={() => runAction("pay")}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Mark paid
            </button>
            <button
              disabled={actionLoading}
              onClick={() => runAction("cancel")}
              className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        )}
      </div>

      <div className="rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Unit price</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Line total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2">{item.productName}</td>
                <td className="px-3 py-2">{formatMoney(item.unitPrice)}</td>
                <td className="px-3 py-2">{item.quantity}</td>
                <td className="px-3 py-2">{formatMoney(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 rounded border bg-white p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-500">Subtotal</span>
          <span>{formatMoney(invoice.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Tax</span>
          <span>{formatMoney(invoice.taxAmount)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatMoney(invoice.total)}</span>
        </div>
      </div>

      {invoice.notes && (
        <div className="rounded border bg-white p-4 text-sm">
          <p className="font-medium">Notes</p>
          <p className="text-zinc-600">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
}
