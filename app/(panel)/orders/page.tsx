"use client";
import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useActiveRestaurant } from "@/lib/useActiveRestaurant";
import { ClipboardList } from "lucide-react";

type Order = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  qr_codes: { label: string } | null;
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

  async function loadOrders(rid: string) {
    const { data } = await supabase
      .from("orders")
      .select("id, status, total, created_at, qr_codes(label)")
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

  return (
    <>
        <div className="panel-header">
          <div>
            <p className="panel-eyebrow">{restaurant?.name ?? "Live"}</p>
            <h1 className="panel-title">Orders</h1>
          </div>
        </div>

        <div className="space-y-2.5">
          {orders.map((order, i) => (
            <div key={order.id} className="list-row fade-up" style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s` }}>
              <div className="w-10 h-10 rounded-md bg-creamDeep flex items-center justify-center text-goldDeep shrink-0">
                <ClipboardList size={16} strokeWidth={1.6} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {order.qr_codes?.label ?? "Table"} <span className="text-goldDeep">· ₹{order.total}</span>
                </p>
                <p className="text-xs text-inkSoft mt-0.5">
                  {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
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
          ))}
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
