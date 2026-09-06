"use client";
import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useActiveRestaurant } from "@/lib/useActiveRestaurant";
import { ClipboardList, ChevronDown, ChevronUp } from "lucide-react";

type OrderItem = { quantity: number; price_at_order: number; dishes: { name: string } | null };
type Order = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  qr_codes: { label: string } | null;
  order_items: OrderItem[];
};

const STATUSES = ["new", "preparing", "served", "cancelled"];
const STATUS_CLASS: Record<string, string> = {
  new: "status-new",
  preparing: "status-preparing",
  served: "status-served",
  cancelled: "status-cancelled",
};

function OrdersPage() {
  const supabase = createClient();
  const { restaurant } = useActiveRestaurant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function loadOrders(rid: string) {
    const { data } = await supabase
      .from("orders")
      .select("id, status, total, created_at, qr_codes(label), order_items(quantity, price_at_order, dishes(name))")
      .eq("restaurant_id", rid)
      .order("created_at", { ascending: false });
    setOrders((data as any) ?? []);
  }

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
    await supabase.from("orders").update({ status }).eq("id", id);
    if (restaurant) loadOrders(restaurant.id);
  }

  function toggle(id: string) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  return (
    <>
        <div className="panel-header">
          <div>
            <p className="panel-eyebrow">{restaurant?.name ?? "Live"}</p>
            <h1 className="panel-title">Orders</h1>
          </div>
        </div>

        <div className="space-y-2.5">
          {orders.map((order, i) => {
            const isOpen = !!expanded[order.id];
            return (
              <div key={order.id} className="list-row fade-up" style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s`, flexDirection: "column", alignItems: "stretch" }}>
                <div className="flex items-center gap-4 w-full">
                  <div className="w-10 h-10 rounded-md bg-creamDeep flex items-center justify-center text-goldDeep shrink-0">
                    <ClipboardList size={16} strokeWidth={1.6} />
                  </div>
                  <button onClick={() => toggle(order.id)} className="flex-1 text-left">
                    <p className="text-sm font-medium">
                      {order.qr_codes?.label ?? "Table"} <span className="text-goldDeep">· ₹{order.total}</span>
                      <span className="text-inkSoft font-normal"> · {order.order_items?.length ?? 0} item{(order.order_items?.length ?? 0) !== 1 ? "s" : ""}</span>
                    </p>
                    <p className="text-xs text-inkSoft mt-0.5">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
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
                  <button onClick={() => toggle(order.id)} className="p-1.5 text-inkSoft">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-ink/10 pl-14 space-y-1.5">
                    {(order.order_items ?? []).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span>{item.quantity}× {item.dishes?.name ?? "Unknown dish"}</span>
                        <span className="text-inkSoft">₹{(item.quantity * item.price_at_order).toFixed(0)}</span>
                      </div>
                    ))}
                    {(!order.order_items || order.order_items.length === 0) && (
                      <p className="text-sm text-inkSoft">No item details for this order.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {orders.length === 0 && (
            <div className="section-card text-center py-12">
              <p className="text-sm text-inkSoft">No orders yet.</p>
            </div>
          )}
        </div>
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
