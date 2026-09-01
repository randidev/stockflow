export type InvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  DRAFT: "bg-surface-2 text-ink-2",
  ISSUED: "bg-accent-soft text-accent",
  PAID: "bg-success-bg text-success",
  CANCELLED: "bg-danger-bg text-danger line-through decoration-1",
};

export function statusBadgeClass(status: InvoiceStatus): string {
  return `inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[status]}`;
}
