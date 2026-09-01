"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { statusBadgeClass, type InvoiceStatus } from "@/lib/status";

type Invoice = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  status: InvoiceStatus;
  total: number;
  issueDate: string;
};

const STATUSES = ["", "DRAFT", "ISSUED", "PAID", "CANCELLED"] as const;

export default function InvoicesPage() {
  const [items, setItems] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) params.set("status", status);
    api<{ items: Invoice[]; total: number }>(`/invoices?${params}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load invoices"))
      .finally(() => setLoading(false));
  }, [page, status]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Invoices</h1>
          <p className="text-sm text-ink-2">{total} total</p>
        </div>
        <Link href="/invoices/new" className="btn-primary">
          New invoice
        </Link>
      </div>

      <select
        value={status}
        onChange={(e) => {
          setPage(1);
          setStatus(e.target.value);
        }}
        className="input max-w-48"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s || "All statuses"}
          </option>
        ))}
      </select>

      {loading && <p className="text-sm text-ink-2">Loading invoices...</p>}
      {error && <p className="banner-danger">{error}</p>}

      {!loading && !error && (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-ink-2">
                    No invoices found.
                  </td>
                </tr>
              )}
              {items.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <Link href={`/invoices/${inv.id}`} className="link">
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="text-ink">{inv.customerName}</td>
                  <td>
                    <span className={statusBadgeClass(inv.status)}>{inv.status}</span>
                  </td>
                  <td className="font-medium text-ink">{formatMoney(inv.total)}</td>
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
