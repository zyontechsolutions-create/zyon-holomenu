"use client";
import { useEffect, useMemo, useState, Suspense } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useActiveRestaurant } from "@/lib/useActiveRestaurant";
import StatCard from "@/components/StatCard";

type TopDish = { name: string; views: number };
type OrderRow = { id: string; total: number; created_at: string; status: string };

function localDateKey(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayKey() {
  return localDateKey(new Date().toISOString());
}

const STATUS_LABEL: Record<string, string> = { new: "Received", preparing: "Preparing", served: "Served", cancelled: "Cancelled" };

function DashboardPage() {
  const supabase = createClient();
  const { restaurant, loading: restaurantLoading } = useActiveRestaurant();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ views: 0, orders: 0, aov: 0, conversion: 0 });
  const [topDishes, setTopDishes] = useState<TopDish[]>([]);
  const [allOrders, setAllOrders] = useState<OrderRow[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayKey());

  useEffect(() => {
    async function load() {
      if (!restaurant) { setLoading(restaurantLoading); return; }

      const [{ count: viewsCount }, { data: orders }, { data: views }] = await Promise.all([
        supabase.from("menu_views").select("*", { count: "exact", head: true }).eq("restaurant_id", restaurant.id).is("dish_id", null),
        supabase.from("orders").select("id, total, created_at, status").eq("restaurant_id", restaurant.id).order("created_at", { ascending: false }),
        supabase.from("menu_views").select("dish_id, dishes(name)").eq("restaurant_id", restaurant.id).not("dish_id", "is", null),
      ]);

      const orderCount = orders?.length ?? 0;
      const revenue = orders?.reduce((sum, o) => sum + Number(o.total), 0) ?? 0;
      const aov = orderCount ? revenue / orderCount : 0;
      const conversion = viewsCount ? Math.round((orderCount / viewsCount) * 100) : 0;

      const counts: Record<string, number> = {};
      views?.forEach((v: any) => {
        const name = v.dishes?.name ?? "Unknown dish";
        counts[name] = (counts[name] || 0) + 1;
      });
      const top = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, views]) => ({ name, views }));

      setStats({ views: viewsCount ?? 0, orders: orderCount, aov, conversion });
      setTopDishes(top);
      setAllOrders((orders as any) ?? []);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  const availableDates = useMemo(() => {
    const set = new Set(allOrders.map((o) => localDateKey(o.created_at)));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [allOrders]);

  const dayOrders = useMemo(
    () => allOrders.filter((o) => localDateKey(o.created_at) === selectedDate),
    [allOrders, selectedDate]
  );
  const dayRevenue = dayOrders.reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <>
        <div className="panel-header">
          <div>
            <p className="panel-eyebrow">{restaurant?.name || "Your restaurant"}</p>
            <h1 className="panel-title">Menu Overview</h1>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-inkSoft">Loading...</p>
        ) : (
          <>
            <div className="stat-grid">
              <StatCard label="Total Views" value={stats.views.toLocaleString()} />
              <StatCard label="Orders" value={stats.orders.toLocaleString()} />
              <StatCard label="Avg Order Value" value={`₹${stats.aov.toFixed(0)}`} />
              <StatCard label="Conversion Rate" value={`${stats.conversion}%`} />
            </div>

            <div className="section-card fade-up mt-5" style={{ animationDelay: ".05s" }}>
              <div className="flex items-center justify-between flex-wrap gap-3 mb-3.5">
                <h2 style={{ margin: 0 }}>Orders by Day</h2>
                <div className="flex items-center gap-2">
                  <button
                    className={`status-pill ${selectedDate === todayKey() ? "status-new" : "status-cancelled"}`}
                    style={{ cursor: "pointer", border: "none" }}
                    onClick={() => setSelectedDate(todayKey())}
                  >
                    Today
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    max={todayKey()}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border border-ink/15 rounded-md px-2.5 py-1.5 text-sm bg-cream focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div className="flex items-baseline gap-6 mb-4">
                <div>
                  <div className="num" style={{ fontSize: 28 }}>{dayOrders.length}</div>
                  <div className="lbl">orders on {selectedDate === todayKey() ? "today" : selectedDate}</div>
                </div>
                <div>
                  <div className="num" style={{ fontSize: 28 }}>₹{dayRevenue.toFixed(0)}</div>
                  <div className="lbl">revenue</div>
                </div>
              </div>

              {dayOrders.length === 0 ? (
                <p className="text-sm text-inkSoft">No orders on this date.</p>
              ) : (
                <div className="space-y-2">
                  {dayOrders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-sm py-1.5" style={{ borderBottom: "1px solid rgba(30,27,22,0.06)" }}>
                      <span className="text-inkSoft">
                        {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className={`status-pill status-${o.status === "new" ? "new" : o.status === "served" ? "served" : o.status === "cancelled" ? "cancelled" : "preparing"}`}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                      <span className="font-medium">₹{Number(o.total).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              )}

              {availableDates.length > 1 && (
                <p className="text-xs text-inkSoft mt-3.5">
                  Days with orders: {availableDates.slice(0, 8).join(", ")}{availableDates.length > 8 ? "…" : ""}
                </p>
              )}
            </div>

            <div className="section-card fade-up mt-5" style={{ animationDelay: ".1s" }}>
              <h2>Top Viewed Dishes</h2>
              {topDishes.length === 0 ? (
                <p className="text-sm text-inkSoft">
                  No views logged yet — once your QR codes go live, this fills in automatically.
                </p>
              ) : (
                <div className="space-y-3.5">
                  {topDishes.map((d) => (
                    <div key={d.name} className="flex items-center gap-3 text-sm">
                      <span className="w-36 truncate">{d.name}</span>
                      <div className="flex-1 h-1.5 bg-creamDeep rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gold rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${(d.views / topDishes[0].views) * 100}%` }}
                        />
                      </div>
                      <span className="text-inkSoft w-8 text-right">{d.views}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </>
  );
}

export default function DashboardPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-inkSoft">Loading...</div>}>
      <DashboardPage />
    </Suspense>
  );
}
