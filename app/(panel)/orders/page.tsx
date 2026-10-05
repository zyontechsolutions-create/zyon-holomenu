"use client";
import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useSearchParams } from "next/navigation";
import { useActiveRestaurant } from "@/lib/useActiveRestaurant";
import { ClipboardList, ChevronDown, ChevronUp, Receipt } from "lucide-react";
import BillModal from "@/components/BillModal";
import { formatBillNo } from "@/lib/billing";

type OrderItem = { quantity: number; price_at_order: number; note: string | null; dishes: { name: string } | null };
type Order = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  paid: boolean;
  qr_code_id: string | null;
  bill_number: number | null;
  bill_details: { prefix?: string } | null;
  qr_codes: { label: string } | null;
  order_items: OrderItem[];
};

const STATUSES = ["new", "preparing", "served", "cancelled"];
type Filter = "all" | "unpaid" | "new" | "preparing" | "served" | "cancelled";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "new", label: "New" },
  { key: "preparing", label: "Preparing" },
  { key: "served", label: "Served" },
  { key: "cancelled", label: "Cancelled" },
];
// Unpaid = not paid yet and not cancelled (cancelled orders owe nothing)
function matchesFilter(o: { status: string; paid: boolean }, f: Filter) {
  if (f === "all") return true;
  if (f === "unpaid") return !o.paid && o.status !== "cancelled";
  return o.status === f;
}

const STATUS_CLASS: Record<string, string> = {
  new: "status-new",
  preparing: "status-preparing",
  served: "status-served",
  cancelled: "status-cancelled",
};

function OrdersPage() {
  const supabase = createClient();
  const { restaurant, clearNewOrders } = useActiveRestaurant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [billOrderId, setBillOrderId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [payingTable, setPayingTable] = useState<string | null>(null);

  // Remember the last chosen tab on this device
  useEffect(() => {
    try {
      const saved = localStorage.getItem("zyon-orders-filter") as Filter | null;
      if (saved && FILTERS.some((f) => f.key === saved)) setFilter(saved);
    } catch { /* storage blocked */ }
  }, []);
  function chooseFilter(f: Filter) {
    setFilter(f);
    try { localStorage.setItem("zyon-orders-filter", f); } catch { /* storage blocked */ }
  }
  const searchParams = useSearchParams();
  const overrideId = searchParams.get("restaurant");
  const settingsHref = overrideId ? `/settings?restaurant=${overrideId}` : "/settings";

  async function loadOrders(rid: string) {
    const { data } = await supabase
      .from("orders")
      .select("id, status, total, created_at, paid, qr_code_id, bill_number, bill_details, qr_codes(label), order_items(quantity, price_at_order, note, dishes(name))")
      .eq("restaurant_id", rid)
      .order("created_at", { ascending: false });
    setOrders((data as any) ?? []);
  }

  // Staff has now seen the Orders page — clear the sidebar badge.
  useEffect(() => {
    clearNewOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  useEffect(() => {
    if (!restaurant) return;
    loadOrders(restaurant.id);
    const channel = supabase
      .channel("orders-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` },
        () => loadOrders(restaurant.id)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  async function updateStatus(id: string, status: string) {
    setActionError("");
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) {
      setActionError(/billed order cannot be cancelled/i.test(error.message)
        ? "This order already has a bill, so it can't be cancelled."
        : "Couldn't update the order. Please try again.");
    }
    if (restaurant) loadOrders(restaurant.id);
  }

  async function togglePaid(id: string, current: boolean) {
    setActionError("");
    const { error } = await supabase.from("orders").update({ paid: !current }).eq("id", id);
    if (error) setActionError("Couldn't update payment status. Please try again.");
    if (restaurant) loadOrders(restaurant.id);
  }

  async function markTablePaid(key: string, ids: string[], label: string, amount: number, count: number) {
    if (ids.length === 0 || payingTable) return;
    const ok = window.confirm(
      `Mark ${count} unpaid order${count === 1 ? "" : "s"} for ${label} as paid?\n\nTotal: ₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
    );
    if (!ok) return;
    setActionError("");
    setPayingTable(key);
    const { data, error } = await supabase.from("orders").update({ paid: true }).in("id", ids).select("id");
    setPayingTable(null);
    if (error) setActionError("Couldn't mark these orders as paid. Please try again.");
    else if (!data || data.length !== ids.length) setActionError("Some orders could not be updated. Please check and try again.");
    if (restaurant) loadOrders(restaurant.id);
  }

  function toggle(id: string) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  const visibleOrders = orders.filter((o) => matchesFilter(o, filter));

  // Unpaid orders grouped by table, for one-tap settling
  const unpaidGroups = (() => {
    type Group = { key: string; label: string; ids: string[]; amount: number };
    const map = new Map<string, Group>();
    orders.forEach((o) => {
      if (o.paid || o.status === "cancelled") return;
      const key = o.qr_code_id ?? `label:${o.qr_codes?.label ?? "none"}`;
      const g: Group = map.get(key) ?? { key, label: o.qr_codes?.label ?? "Table", ids: [], amount: 0 };
      g.ids.push(o.id);
      g.amount += Number(o.total) || 0;
      map.set(key, g);
    });
    return Array.from(map.values());
  })();

  return (
    <>
        <div className="panel-header">
          <div>
            <p className="panel-eyebrow">{restaurant?.name ?? "Live"}</p>
            <h1 className="panel-title">Orders</h1>
          </div>
        </div>

        {actionError && (
          <p className="text-xs text-red-600 mb-3" role="alert">{actionError}</p>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1" role="tablist" aria-label="Filter orders" style={{ scrollbarWidth: "none" }}>
          {FILTERS.map((f) => {
            const count = orders.filter((o) => matchesFilter(o, f.key)).length;
            const active = filter === f.key;
            const alert = f.key === "unpaid" && count > 0 && !active;
            return (
              <button
                key={f.key}
                role="tab"
                aria-selected={active}
                onClick={() => chooseFilter(f.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors ${
                  active ? "bg-ink text-cream border-ink" : "border-ink/15 hover:bg-cream"
                }`}
                style={alert ? { color: "#b23b3b", borderColor: "#e8b4b4", background: "#fbe4e4" } : undefined}
              >
                {f.label}
                <span className={active ? "opacity-70" : "text-inkSoft"} style={alert ? { color: "#b23b3b" } : undefined}>{count}</span>
              </button>
            );
          })}
        </div>

        {filter === "unpaid" && unpaidGroups.length > 0 && (
          <div className="section-card mb-3" style={{ padding: 14 }}>
            <p className="text-xs uppercase tracking-widest text-inkSoft mb-2.5">Settle by table</p>
            <div className="space-y-2">
              {unpaidGroups.map((g) => (
                <div key={g.key} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{g.label}</p>
                    <p className="text-xs text-inkSoft">
                      {g.ids.length} unpaid order{g.ids.length === 1 ? "" : "s"} · ₹{g.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <button
                    onClick={() => markTablePaid(g.key, g.ids, g.label, g.amount, g.ids.length)}
                    disabled={payingTable !== null}
                    className="shrink-0 rounded-md px-3.5 py-1.5 text-xs font-medium"
                    style={{ background: "#e1f0e5", color: "#1c7a44", border: "none", opacity: payingTable ? 0.6 : 1, cursor: payingTable ? "default" : "pointer" }}
                  >
                    {payingTable === g.key ? "Saving…" : "Mark all paid"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2.5">
          {visibleOrders.map((order, i) => {
            const isOpen = !!expanded[order.id];
            return (
              <div key={order.id} className="list-row fade-up" style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s`, flexDirection: "column", alignItems: "stretch" }}>
                <div className="order-row flex items-center gap-4 w-full">
                  <div className="order-icon w-10 h-10 rounded-md bg-creamDeep flex items-center justify-center text-goldDeep shrink-0">
                    <ClipboardList size={16} strokeWidth={1.6} />
                  </div>
                  <button onClick={() => toggle(order.id)} className="order-info flex-1 text-left min-w-0">
                    <p className="text-sm font-medium">
                      {order.qr_codes?.label ?? "Table"} <span className="text-goldDeep">· ₹{order.total}</span>
                      <span className="text-inkSoft font-normal"> · {order.order_items?.length ?? 0} item{(order.order_items?.length ?? 0) !== 1 ? "s" : ""}</span>
                    </p>
                    <p className="text-xs text-inkSoft mt-0.5">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                  </button>
                  <div className="order-controls flex items-center gap-4">
                  <button
                    onClick={() => togglePaid(order.id, order.paid)}
                    className="status-pill"
                    style={{
                      background: order.paid ? "#e1f0e5" : "#fbe4e4",
                      color: order.paid ? "#1c7a44" : "#b23b3b",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {order.paid ? "Paid" : "Unpaid"}
                  </button>
                  <select
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                    className={`status-pill ${STATUS_CLASS[order.status] ?? "status-preparing"} capitalize border-none cursor-pointer`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  </div>
                  <button onClick={() => toggle(order.id)} className="order-chev p-1.5 text-inkSoft">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-ink/10 pl-14 space-y-1.5">
                    {(order.order_items ?? []).map((item, idx) => (
                      <div key={idx}>
                        <div className="flex items-center justify-between text-sm">
                          <span>{item.quantity}× {item.dishes?.name ?? "Unknown dish"}</span>
                          <span className="text-inkSoft">₹{(item.quantity * item.price_at_order).toFixed(0)}</span>
                        </div>
                        {item.note && (
                          <p className="text-xs text-goldDeep" style={{ marginTop: -1, marginBottom: 3 }}>
                            Note: {item.note}
                          </p>
                        )}
                      </div>
                    ))}
                    {(!order.order_items || order.order_items.length === 0) && (
                      <p className="text-sm text-inkSoft">No item details for this order.</p>
                    )}
                    {order.status !== "cancelled" && (
                      <div className="pt-2 flex items-center gap-3">
                        <button
                          onClick={() => setBillOrderId(order.id)}
                          className="inline-flex items-center gap-1.5 border border-ink/15 rounded-md px-3 py-1.5 text-xs font-medium hover:bg-cream transition-colors"
                        >
                          <Receipt size={14} /> {order.bill_number ? "View bill" : "Generate bill"}
                        </button>
                        {order.bill_number && (
                          <span className="text-xs text-inkSoft">{formatBillNo(order.bill_details?.prefix, order.bill_number)}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {visibleOrders.length === 0 && (
            <div className="section-card text-center py-12">
              <p className="text-sm text-inkSoft">
                {orders.length === 0 ? "No orders yet." : filter === "unpaid" ? "No unpaid orders. 🎉" : "No orders match this filter."}
              </p>
              {orders.length > 0 && filter !== "all" && (
                <button onClick={() => chooseFilter("all")} className="text-xs underline text-inkSoft mt-2">Show all orders</button>
              )}
            </div>
          )}
        </div>
        {billOrderId && (
          <BillModal
            orderId={billOrderId}
            settingsHref={settingsHref}
            onClose={() => { setBillOrderId(null); if (restaurant) loadOrders(restaurant.id); }}
          />
        )}
      </>
  );
}

export default function OrdersPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-inkSoft">Loading...</div>}>
      <OrdersPage />
    </Suspense>
  );
}
