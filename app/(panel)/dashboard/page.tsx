"use client";
import { useEffect, useMemo, useState, Suspense } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useActiveRestaurant } from "@/lib/useActiveRestaurant";
import StatCard from "@/components/StatCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

type TopDish = { name: string; views: number };
type OrderRow = { id: string; total: number; created_at: string; status: string };
type PeriodType = "day" | "week" | "month";

const STATUS_LABEL: Record<string, string> = { new: "Received", preparing: "Preparing", served: "Served", cancelled: "Cancelled" };

// ---- date helpers (all local time, so "today" matches the restaurant's clock) ----
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}
function startOfWeek(d: Date) {
  // Monday-start week
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  return addDays(startOfDay(d), diff);
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getRange(type: PeriodType, anchor: Date) {
  if (type === "day") {
    const start = startOfDay(anchor);
    return { start, end: addDays(start, 1) };
  }
  if (type === "week") {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 7) };
  }
  const start = startOfMonth(anchor);
  return { start, end: addMonths(start, 1) };
}

function shiftAnchor(type: PeriodType, anchor: Date, dir: 1 | -1) {
  if (type === "day") return addDays(anchor, dir);
  if (type === "week") return addDays(anchor, dir * 7);
  return addMonths(anchor, dir);
}

function formatLabel(type: PeriodType, anchor: Date) {
  const { start, end } = getRange(type, anchor);
  if (type === "day") return start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  if (type === "week") {
    const last = addDays(end, -1);
    return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${last.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return start.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function toDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromDateInputValue(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function inRange(iso: string, start: Date, end: Date) {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

function pctDelta(curr: number, prev: number): { text: string; tone: "up" | "down" | "flat" | "new" } {
  if (prev === 0) {
    if (curr === 0) return { text: "–", tone: "flat" };
    return { text: "New", tone: "new" };
  }
  const change = ((curr - prev) / prev) * 100;
  if (Math.abs(change) < 1) return { text: "±0%", tone: "flat" };
  return { text: `${change > 0 ? "▲" : "▼"} ${Math.abs(Math.round(change))}%`, tone: change > 0 ? "up" : "down" };
}

function DeltaBadge({ curr, prev }: { curr: number; prev: number }) {
  const d = pctDelta(curr, prev);
  const color = d.tone === "up" ? "#1c7a44" : d.tone === "down" ? "#b23b3b" : d.tone === "new" ? "#8C6428" : "#9a9284";
  return <span style={{ fontSize: 11.5, fontWeight: 600, color }}>{d.text}</span>;
}

function DashboardPage() {
  const supabase = createClient();
  const { restaurant, loading: restaurantLoading } = useActiveRestaurant();
  const [loading, setLoading] = useState(true);
  const [allTimeStats, setAllTimeStats] = useState({ views: 0, orders: 0, aov: 0, conversion: 0 });
  const [topDishes, setTopDishes] = useState<TopDish[]>([]);
  const [allOrders, setAllOrders] = useState<OrderRow[]>([]);
  const [pageVisits, setPageVisits] = useState<{ created_at: string }[]>([]);

  const [periodType, setPeriodType] = useState<PeriodType>("day");
  const [anchor, setAnchor] = useState(new Date());

  useEffect(() => {
    async function load() {
      if (!restaurant) { setLoading(restaurantLoading); return; }

      const [{ data: orders }, { data: views }, { data: visits }] = await Promise.all([
        supabase.from("orders").select("id, total, created_at, status").eq("restaurant_id", restaurant.id).order("created_at", { ascending: false }),
        supabase.from("menu_views").select("dish_id, dishes(name)").eq("restaurant_id", restaurant.id).not("dish_id", "is", null),
        supabase.from("menu_views").select("created_at").eq("restaurant_id", restaurant.id).is("dish_id", null),
      ]);

      const orderCount = orders?.length ?? 0;
      const revenue = orders?.reduce((sum, o) => sum + Number(o.total), 0) ?? 0;
      const aov = orderCount ? revenue / orderCount : 0;
      const viewCount = visits?.length ?? 0;
      const conversion = viewCount ? Math.round((orderCount / viewCount) * 100) : 0;

      const counts: Record<string, number> = {};
      views?.forEach((v: any) => {
        const name = v.dishes?.name ?? "Unknown dish";
        counts[name] = (counts[name] || 0) + 1;
      });
      const top = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, views]) => ({ name, views }));

      setAllTimeStats({ views: viewCount, orders: orderCount, aov, conversion });
      setTopDishes(top);
      setAllOrders((orders as any) ?? []);
      setPageVisits((visits as any) ?? []);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  const { start, end } = useMemo(() => getRange(periodType, anchor), [periodType, anchor]);
  const prevAnchor = useMemo(() => shiftAnchor(periodType, anchor, -1), [periodType, anchor]);
  const { start: prevStart, end: prevEnd } = useMemo(() => getRange(periodType, prevAnchor), [periodType, prevAnchor]);

  const periodOrders = useMemo(() => allOrders.filter((o) => inRange(o.created_at, start, end)), [allOrders, start, end]);
  const prevPeriodOrders = useMemo(() => allOrders.filter((o) => inRange(o.created_at, prevStart, prevEnd)), [allOrders, prevStart, prevEnd]);

  const periodViews = useMemo(() => pageVisits.filter((v) => inRange(v.created_at, start, end)).length, [pageVisits, start, end]);
  const prevPeriodViews = useMemo(() => pageVisits.filter((v) => inRange(v.created_at, prevStart, prevEnd)).length, [pageVisits, prevStart, prevEnd]);

  const periodRevenue = periodOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const prevPeriodRevenue = prevPeriodOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const periodAov = periodOrders.length ? periodRevenue / periodOrders.length : 0;
  const prevPeriodAov = prevPeriodOrders.length ? prevPeriodRevenue / prevPeriodOrders.length : 0;
  const periodConversion = periodViews ? Math.round((periodOrders.length / periodViews) * 100) : 0;
  const prevPeriodConversion = prevPeriodViews ? Math.round((prevPeriodOrders.length / prevPeriodViews) * 100) : 0;

  const canGoNext = end.getTime() <= Date.now();

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
            <p className="text-xs uppercase tracking-wide text-inkSoft mb-2" style={{ letterSpacing: 1 }}>All-Time</p>
            <div className="stat-grid">
              <StatCard label="Total Views" value={allTimeStats.views.toLocaleString()} />
              <StatCard label="Orders" value={allTimeStats.orders.toLocaleString()} />
              <StatCard label="Avg Order Value" value={`₹${allTimeStats.aov.toFixed(0)}`} />
              <StatCard label="Conversion Rate" value={`${allTimeStats.conversion}%`} />
            </div>

            <div className="section-card fade-up mt-5" style={{ animationDelay: ".05s" }}>
              <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
                <h2 style={{ margin: 0 }}>Performance</h2>
                <div className="flex items-center gap-1.5">
                  {(["day", "week", "month"] as PeriodType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => { setPeriodType(t); setAnchor(new Date()); }}
                      className={`status-pill ${periodType === t ? "status-new" : "status-cancelled"}`}
                      style={{ cursor: "pointer", border: "none", textTransform: "capitalize" }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 my-3.5">
                <button onClick={() => setAnchor(shiftAnchor(periodType, anchor, -1))} className="p-1.5 text-inkSoft hover:text-ink transition-colors" aria-label="Previous period">
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm font-medium" style={{ minWidth: 190, textAlign: "center" }}>{formatLabel(periodType, anchor)}</span>
                <button
                  onClick={() => canGoNext && setAnchor(shiftAnchor(periodType, anchor, 1))}
                  disabled={!canGoNext}
                  className="p-1.5 text-inkSoft hover:text-ink transition-colors"
                  style={{ opacity: canGoNext ? 1 : 0.3, cursor: canGoNext ? "pointer" : "default" }}
                  aria-label="Next period"
                >
                  <ChevronRight size={18} />
                </button>
                <input
                  type="date"
                  value={toDateInputValue(anchor)}
                  max={toDateInputValue(new Date())}
                  onChange={(e) => e.target.value && setAnchor(fromDateInputValue(e.target.value))}
                  className="border border-ink/15 rounded-md px-2 py-1 text-xs bg-cream focus:outline-none focus:border-gold"
                  style={{ marginLeft: 6 }}
                  aria-label={`Jump to a specific ${periodType}`}
                />
              </div>

              <div className="stat-grid">
                <div className="stat-card-v2 fade-up">
                  <div className="num">{periodOrders.length}</div>
                  <div className="lbl">Orders</div>
                  <DeltaBadge curr={periodOrders.length} prev={prevPeriodOrders.length} />
                </div>
                <div className="stat-card-v2 fade-up">
                  <div className="num">₹{periodRevenue.toFixed(0)}</div>
                  <div className="lbl">Revenue</div>
                  <DeltaBadge curr={periodRevenue} prev={prevPeriodRevenue} />
                </div>
                <div className="stat-card-v2 fade-up">
                  <div className="num">₹{periodAov.toFixed(0)}</div>
                  <div className="lbl">Avg Order Value</div>
                  <DeltaBadge curr={periodAov} prev={prevPeriodAov} />
                </div>
                <div className="stat-card-v2 fade-up">
                  <div className="num">{periodConversion}%</div>
                  <div className="lbl">Conversion Rate</div>
                  <DeltaBadge curr={periodConversion} prev={prevPeriodConversion} />
                </div>
              </div>
              <p className="text-xs text-inkSoft mt-2.5">
                vs. previous {periodType} ({periodViews} views this {periodType}, {prevPeriodViews} the one before)
              </p>

              {periodOrders.length === 0 ? (
                <p className="text-sm text-inkSoft mt-4">No orders in this {periodType}.</p>
              ) : (
                <div className="space-y-2 mt-4" style={{ maxHeight: 320, overflowY: "auto" }}>
                  {periodOrders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-sm py-1.5" style={{ borderBottom: "1px solid rgba(30,27,22,0.06)" }}>
                      <span className="text-inkSoft">
                        {periodType === "day"
                          ? new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : new Date(o.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className={`status-pill status-${o.status === "new" ? "new" : o.status === "served" ? "served" : o.status === "cancelled" ? "cancelled" : "preparing"}`}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                      <span className="font-medium">₹{Number(o.total).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="section-card fade-up mt-5" style={{ animationDelay: ".1s" }}>
              <h2>Top Viewed Dishes <span className="text-xs text-inkSoft font-normal">(all-time)</span></h2>
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
