"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { statusBadgeClass, type InvoiceStatus } from "@/lib/status";

type InvoiceItem = { id: string; productName: string; unitPrice: number; quantity: number; lineTotal: number };
type Invoice = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  status: InvoiceStatus;
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

  if (loading) return <p className="text-sm text-ink-2">Loading invoice...</p>;
  if (error) return <p className="banner-danger">{error}</p>;
  if (!invoice) return null;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">{invoice.invoiceNumber}</h1>
          <p className="text-sm text-ink-2">{invoice.customerName}</p>
        </div>
        <span className={statusBadgeClass(invoice.status)}>{invoice.status}</span>
      </div>

      {actionError && <p className="banner-danger">{actionError}</p>}

      {(invoice.status === "DRAFT" || invoice.status === "ISSUED") && (
        <div className="flex gap-2">
          {invoice.status === "DRAFT" && (
            <button disabled={actionLoading} onClick={() => runAction("issue")} className="btn-primary">
              Issue
            </button>
          )}
          {invoice.status === "ISSUED" && (
            <button disabled={actionLoading} onClick={() => runAction("pay")} className="btn-primary">
              Mark paid
            </button>
          )}
          <button disabled={actionLoading} onClick={() => runAction("cancel")} className="btn-secondary">
            Cancel
          </button>
        </div>
      )}

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Unit price</th>
              <th>Qty</th>
              <th>Line total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className="font-medium text-ink">{item.productName}</td>
                <td className="tabular-nums text-ink-2">{formatMoney(item.unitPrice)}</td>
                <td className="tabular-nums text-ink-2">{item.quantity}</td>
                <td className="tabular-nums font-medium text-ink">{formatMoney(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card space-y-1.5 p-5 text-sm">
        <div className="flex justify-between text-ink-2">
          <span>Subtotal</span>
          <span className="tabular-nums text-ink">{formatMoney(invoice.subtotal)}</span>
        </div>
        <div className="flex justify-between text-ink-2">
          <span>Tax</span>
          <span className="tabular-nums text-ink">{formatMoney(invoice.taxAmount)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold text-ink">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(invoice.total)}</span>
        </div>
      </div>

      {invoice.notes && (
        <div className="card space-y-1 p-5 text-sm">
          <p className="font-medium text-ink">Notes</p>
          <p className="text-ink-2">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
}
