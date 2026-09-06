"use client";
import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useActiveRestaurant } from "@/lib/useActiveRestaurant";
import StatCard from "@/components/StatCard";

type TopDish = { name: string; views: number };

function DashboardPage() {
  const supabase = createClient();
  const { restaurant, loading: restaurantLoading } = useActiveRestaurant();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ views: 0, orders: 0, aov: 0, conversion: 0 });
  const [topDishes, setTopDishes] = useState<TopDish[]>([]);

  useEffect(() => {
    async function load() {
      if (!restaurant) { setLoading(restaurantLoading); return; }

      const [{ count: viewsCount }, { data: orders }, { data: views }] = await Promise.all([
        supabase.from("menu_views").select("*", { count: "exact", head: true }).eq("restaurant_id", restaurant.id),
        supabase.from("orders").select("total").eq("restaurant_id", restaurant.id),
        supabase.from("menu_views").select("dish_id, dishes(name)").eq("restaurant_id", restaurant.id),
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
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

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
