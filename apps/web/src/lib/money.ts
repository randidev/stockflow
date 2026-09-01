// Prices are stored as integer minor units (e.g. Rp 15.000 -> 1500000) to avoid float rounding.
export function formatMoney(minorUnits: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(minorUnits / 100);
}
