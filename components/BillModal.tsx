"use client";
import { useEffect, useRef, useState } from "react";
// react-dom ships no types in this project (@types/react-dom is not installed); it exists at runtime.
// @ts-ignore
import { createPortal } from "react-dom";
import Link from "next/link";
import { Printer, Share2, X, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { BillDetails, calcBill, formatBillNo, money } from "@/lib/billing";

type BillOrder = {
  id: string;
  total: number;
  paid: boolean;
  created_at: string;
  bill_number: number;
  billed_at: string;
  bill_details: BillDetails;
  qr_codes: { label: string } | null;
  order_items: { quantity: number; price_at_order: number; dishes: { name: string } | null }[];
};

export default function BillModal({ orderId, onClose, settingsHref = "/settings" }: { orderId: string; onClose: () => void; settingsHref?: string }) {
  const supabase = createClient();
  const [order, setOrder] = useState<BillOrder | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const reqId = useRef(0); // ignore responses from older requests

  async function load(refresh = false) {
    if (busy && refresh) return; // ignore double taps
    const my = ++reqId.current;
    setBusy(true);
    setError("");
    // Assigns the next bill number the first time; returns the same bill afterwards.
    const { error: rpcErr } = await supabase.rpc("assign_bill", { p_order_id: orderId, p_refresh: refresh });
    if (my !== reqId.current) return;
    if (rpcErr) {
      setError(
        /assign_bill|function|column/i.test(rpcErr.message)
          ? "Billing isn't set up in the database yet. Run supabase/billing.sql in the Supabase SQL editor."
          : rpcErr.message
      );
      setBusy(false);
      return;
    }
    const { data, error: selErr } = await supabase
      .from("orders")
      .select("id, total, paid, created_at, bill_number, billed_at, bill_details, qr_codes(label), order_items(quantity, price_at_order, dishes(name))")
      .eq("id", orderId)
      .single();
    if (my !== reqId.current) return;
    if (selErr || !data) setError("Couldn't load the bill. Please try again.");
    else setOrder(data as any);
    setBusy(false);
  }

  useEffect(() => {
    setMounted(true);
    load();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      reqId.current++;
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const d = order?.bill_details;
  const billNo = order && d ? formatBillNo(d.prefix, order.bill_number) : "";
  const calc = order && d ? calcBill(Number(order.total), Number(d.gst_rate), d.inclusive) : null;
  const hasGst = !!d && Number(d.gst_rate) > 0;
  const isTaxInvoice = !!d?.gstin;
  const incomplete = !!d && !d.address && !d.gstin;

  function shareText() {
    if (!order || !d || !calc) return "";
    const lines = [
      `${d.name}`,
      `${isTaxInvoice ? "Tax Invoice" : "Bill"} ${billNo}`,
      new Date(order.billed_at).toLocaleString("en-IN"),
      order.qr_codes?.label ? `Table: ${order.qr_codes.label}` : "",
      "",
      ...order.order_items.map((it) => `${it.quantity} x ${it.dishes?.name ?? "Item"} - ${money(it.quantity * Number(it.price_at_order))}`),
      "",
      ...(hasGst
        ? [
            `Taxable: ${money(calc.taxable)}`,
            `CGST ${Number(d.gst_rate) / 2}%: ${money(calc.cgst)}`,
            `SGST ${Number(d.gst_rate) / 2}%: ${money(calc.sgst)}`,
          ]
        : []),
      `Total: ${money(calc.grand)}`,
      d.footer ?? "",
    ];
    return lines.filter((l, i, a) => l !== "" || (a[i - 1] !== "" && i !== 0)).join("\n").trim();
  }

  async function share() {
    const text = shareText();
    if (!text) return;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try { await (navigator as any).share({ title: `Bill ${billNo}`, text }); return; } catch { /* cancelled */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  if (!mounted) return null;

  return createPortal(
    <div className="bill-overlay" onClick={onClose}>
      <div className="bill-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="bill-toolbar">
          <p className="text-xs uppercase tracking-widest text-inkSoft">{isTaxInvoice ? "Tax invoice" : "Bill"}</p>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-inkSoft hover:text-ink"><X size={18} /></button>
        </div>

        {error && <p className="text-sm text-red-600 px-1 py-4">{error}</p>}
        {!order && !error && <p className="text-sm text-inkSoft px-1 py-8 text-center">Preparing bill…</p>}

        {order && d && calc && (
          <>
            {incomplete && (
              <p className="text-xs text-goldDeep bg-creamDeep rounded-md px-3 py-2 mb-3">
                Add your address and GSTIN in <Link href={settingsHref} className="underline">Settings</Link>, then tap Refresh details.
              </p>
            )}

            <div className="bill-print">
              <div className="bill-sheet">
                <div className="bill-center">
                  <p className="bill-name">{d.name}</p>
                  {d.address && <p className="bill-small">{d.address}</p>}
                  {d.phone && <p className="bill-small">Ph: {d.phone}</p>}
                  {d.gstin && <p className="bill-small">GSTIN: {d.gstin}</p>}
                </div>
                <div className="bill-rule" />
                <p className="bill-title">{isTaxInvoice ? "TAX INVOICE" : "BILL"}</p>
                <div className="bill-row bill-small"><span>Bill no: {billNo}</span><span>{new Date(order.billed_at).toLocaleDateString("en-IN")}</span></div>
                <div className="bill-row bill-small"><span>{order.qr_codes?.label ?? "Table"}</span><span>{new Date(order.billed_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></div>
                <div className="bill-rule" />
                <div className="bill-row bill-head"><span>Item</span><span>Amount</span></div>
                {order.order_items.map((it, i) => (
                  <div key={i} className="bill-row">
                    <span>{it.quantity} × {it.dishes?.name ?? "Item"}<span className="bill-small"> @ {money(Number(it.price_at_order))}</span></span>
                    <span>{money(it.quantity * Number(it.price_at_order))}</span>
                  </div>
                ))}
                <div className="bill-rule" />
                {hasGst && (
                  <>
                    <div className="bill-row bill-small"><span>Taxable value</span><span>{money(calc.taxable)}</span></div>
                    <div className="bill-row bill-small"><span>CGST @ {Number(d.gst_rate) / 2}%</span><span>{money(calc.cgst)}</span></div>
                    <div className="bill-row bill-small"><span>SGST @ {Number(d.gst_rate) / 2}%</span><span>{money(calc.sgst)}</span></div>
                  </>
                )}
                <div className="bill-row bill-total"><span>TOTAL</span><span>{money(calc.grand)}</span></div>
                {hasGst && d.inclusive && <p className="bill-small bill-center">Prices include GST</p>}
                <div className="bill-rule" />
                <p className="bill-center bill-small">Payment: {order.paid ? "PAID" : "Unpaid"}</p>
                {d.footer && <p className="bill-center bill-small" style={{ marginTop: 6 }}>{d.footer}</p>}
                <p className="bill-center bill-small" style={{ marginTop: 6 }}>Thank you, visit again!</p>
              </div>
            </div>

            <div className="bill-actions">
              <button className="btn-gold flex-1 inline-flex items-center justify-center gap-2" onClick={() => window.print()}>
                <Printer size={15} /> Print / Save PDF
              </button>
              <button className="bill-btn" onClick={share}><Share2 size={15} /> Share</button>
            </div>
            <button
              className="text-xs text-inkSoft underline mt-3 inline-flex items-center gap-1.5 disabled:opacity-50"
              onClick={() => load(true)}
              disabled={busy}
            >
              <RefreshCw size={12} /> Refresh details from Settings
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
