"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/money";

type Invoice = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  status: "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Invoices</h1>
        <Link href="/invoices/new" className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white">
          New invoice
        </Link>
      </div>

      <select
        value={status}
        onChange={(e) => {
          setPage(1);
          setStatus(e.target.value);
        }}
        className="rounded border px-3 py-2 text-sm"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s || "All statuses"}
          </option>
        ))}
      </select>

      {loading && <p className="text-sm text-zinc-500">Loading invoices...</p>}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-3 py-2">Number</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                    No invoices found.
                  </td>
                </tr>
              )}
              {items.map((inv) => (
                <tr key={inv.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link href={`/invoices/${inv.id}`} className="font-medium text-zinc-900 underline">
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{inv.customerName}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium">{inv.status}</span>
                  </td>
                  <td className="px-3 py-2">{formatMoney(inv.total)}</td>
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
