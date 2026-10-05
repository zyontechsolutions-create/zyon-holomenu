// Shared billing helpers: GST maths, bill numbers, formatting.

export type BillDetails = {
  name: string;
  address: string | null;
  phone: string | null;
  gstin: string | null;
  gst_rate: number;
  inclusive: boolean;
  prefix: string;
  footer: string | null;
};

export type BillItem = { name: string; quantity: number; price: number };

export const GST_RATES = [0, 5, 12, 18];

// 15 chars: 2-digit state code, 10-char PAN, entity no., 'Z', checksum
export const GSTIN_RE = /^(0[1-9]|[12][0-9]|3[0-8]|97|99)[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function formatBillNo(prefix: string | null | undefined, n: number) {
  return `${(prefix || "INV").trim()}-${String(n).padStart(4, "0")}`;
}

export function money(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// `total` is the order total as stored. If prices already include GST the bill
// total equals it exactly; otherwise GST is added on top.
export function calcBill(total: number, rate: number, inclusive: boolean) {
  if (!rate) return { taxable: r2(total), cgst: 0, sgst: 0, tax: 0, grand: r2(total) };
  if (inclusive) {
    const taxable = r2(total / (1 + rate / 100));
    const tax = r2(total - taxable);
    const cgst = r2(tax / 2);
    return { taxable, cgst, sgst: r2(tax - cgst), tax, grand: r2(total) };
  }
  const taxable = r2(total);
  const tax = r2((total * rate) / 100);
  const cgst = r2(tax / 2);
  return { taxable, cgst, sgst: r2(tax - cgst), tax, grand: r2(taxable + tax) };
}
