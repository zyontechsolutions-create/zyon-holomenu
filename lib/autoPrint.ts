// Auto-print helpers: per-device settings, kitchen-ticket HTML, silent iframe printing.
// Settings live in this device's localStorage on purpose: only the device that is
// connected to the printer should print, not every phone that opens the panel.

export type AutoPrintSettings = {
  enabled: boolean;
  enabledAt: number; // when it was switched on; older orders are never printed
  width: 58 | 80;    // paper width in mm
};

export type TicketOrder = {
  id: string;
  created_at: string;
  qr_codes: { label: string } | null;
  order_items: { quantity: number; note: string | null; dishes: { name: string } | null }[];
};

const SETTINGS_KEY = (rid: string) => `zyon-autoprint-${rid}`;
const PRINTED_KEY = (rid: string) => `zyon-printed-${rid}`;

export function getAutoPrint(rid: string): AutoPrintSettings {
  const fallback: AutoPrintSettings = { enabled: false, enabledAt: 0, width: 80 };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY(rid));
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    return {
      enabled: !!p.enabled,
      enabledAt: Number(p.enabledAt) || 0,
      width: p.width === 58 ? 58 : 80,
    };
  } catch {
    return fallback;
  }
}

export function saveAutoPrint(rid: string, s: AutoPrintSettings) {
  try { localStorage.setItem(SETTINGS_KEY(rid), JSON.stringify(s)); } catch { /* storage blocked */ }
}

export function isPrinted(rid: string, orderId: string): boolean {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(PRINTED_KEY(rid)) ?? "[]");
    return list.includes(orderId);
  } catch {
    return false;
  }
}

export function markPrinted(rid: string, orderId: string) {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(PRINTED_KEY(rid)) ?? "[]");
    if (!list.includes(orderId)) list.push(orderId);
    localStorage.setItem(PRINTED_KEY(rid), JSON.stringify(list.slice(-300)));
  } catch { /* storage blocked */ }
}

// Order notes and dish names are typed by customers/staff: always escape.
function esc(v: unknown) {
  return String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

export function buildTicketHtml(restaurantName: string, order: TicketOrder, width: 58 | 80, label = "NEW ORDER") {
  const w = width === 58 ? 48 : 72; // printable width in mm
  const d = new Date(order.created_at);
  const when = d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const count = order.order_items.reduce((s, it) => s + it.quantity, 0);
  const rows = order.order_items
    .map(
      (it) => `<div class="it"><span class="q">${esc(it.quantity)} &times;</span> ${esc(it.dishes?.name ?? "Item")}</div>` +
        (it.note ? `<div class="nt">Note: ${esc(it.note)}</div>` : "")
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Order</title><style>
@page{margin:2mm;}
*{box-sizing:border-box;}
body{margin:0 auto;width:${w}mm;font-family:Arial,Helvetica,sans-serif;color:#000;font-size:13px;}
.c{text-align:center;}
.h{font-size:17px;font-weight:700;letter-spacing:1px;margin:2px 0;}
.s{font-size:12px;}
.r{border-top:1px dashed #000;margin:6px 0;}
.row{display:flex;justify-content:space-between;gap:8px;font-size:15px;font-weight:700;}
.it{font-size:15px;margin:4px 0;font-weight:600;}
.q{display:inline-block;min-width:34px;font-weight:700;}
.nt{font-size:12px;margin:-2px 0 4px 34px;font-style:italic;}
</style></head><body>
<div class="c h">${esc(label)}</div>
<div class="c s">${esc(restaurantName)}</div>
<div class="r"></div>
<div class="row"><span>${esc(order.qr_codes?.label ?? "Table")}</span><span>#${esc(order.id.slice(0, 8).toUpperCase())}</span></div>
<div class="s">${esc(when)}</div>
<div class="r"></div>
${rows || '<div class="s">No items</div>'}
<div class="r"></div>
<div class="s">Total items: ${esc(count)}</div>
<div style="height:14mm"></div>
</body></html>`;
}

// Prints through a hidden iframe so the app's own screen is never touched.
// If the browser runs with kiosk printing (see Settings help), this is silent.
export function printHtml(html: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    if (!win) { iframe.remove(); resolve(); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      try { win.focus(); win.print(); } catch { /* print blocked */ }
      setTimeout(() => { iframe.remove(); resolve(); }, 1500);
    }, 400);
  });
}
