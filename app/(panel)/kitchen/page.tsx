"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Maximize, ChefHat, Printer } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { useActiveRestaurant } from "@/lib/useActiveRestaurant";
import { unlockAudioPlayback } from "@/lib/notificationSound";
import { getAutoPrint, saveAutoPrint, AutoPrintSettings } from "@/lib/autoPrint";

type KItem = { quantity: number; note: string | null; dishes: { name: string } | null };
type KOrder = {
  id: string;
  status: "new" | "preparing" | "served" | string;
  created_at: string;
  qr_codes: { label: string } | null;
  order_items: KItem[];
};

const WARN_MIN = 10; // card turns amber
const LATE_MIN = 20; // card turns red
const SERVED_WINDOW_MS = 3 * 60 * 60 * 1000; // show recently served for 3 hours

function elapsedLabel(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

export default function KitchenPage() {
  const supabase = createClient();
  const { restaurant } = useActiveRestaurant();
  const [orders, setOrders] = useState<KOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [soundOn, setSoundOn] = useState(false);
  const [awake, setAwake] = useState(false);
  const wakeLock = useRef<any>(null);
  const [ap, setAp] = useState<AutoPrintSettings>({ enabled: false, enabledAt: 0, width: 80 });
  useEffect(() => {
    if (restaurant) setAp(getAutoPrint(restaurant.id));
  }, [restaurant?.id]);
  function toggleAutoPrint() {
    if (!restaurant) return;
    const next: AutoPrintSettings = { ...ap, enabled: !ap.enabled, enabledAt: !ap.enabled ? Date.now() : ap.enabledAt };
    setAp(next);
    saveAutoPrint(restaurant.id, next);
  }
  function toggleWidth() {
    if (!restaurant) return;
    const next: AutoPrintSettings = { ...ap, width: ap.width === 80 ? 58 : 80 };
    setAp(next);
    saveAutoPrint(restaurant.id, next);
  }

  const load = useCallback(async (rid: string) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error: err } = await supabase
      .from("orders")
      .select("id, status, created_at, qr_codes(label), order_items(quantity, note, dishes(name))")
      .eq("restaurant_id", rid)
      .neq("status", "cancelled")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(150);
    if (err) { setError("Couldn't refresh orders. Retrying…"); return; }
    setError("");
    setOrders((data as any) ?? []);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live updates + safety-net refresh
  useEffect(() => {
    if (!restaurant) return;
    const rid = restaurant.id;
    load(rid);
    const channel = supabase
      .channel(`kitchen-${rid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${rid}` },
        () => {
          load(rid);
          setTimeout(() => load(rid), 2500); // items are saved a moment after the order
        }
      )
      .subscribe();
    const poll = setInterval(() => load(rid), 20000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  // Tick the waiting timers
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Keep the tablet screen awake while this page is open
  useEffect(() => {
    let cancelled = false;
    async function acquire() {
      try {
        const wl = (navigator as any).wakeLock;
        if (!wl || cancelled) return;
        wakeLock.current = await wl.request("screen");
        setAwake(true);
        wakeLock.current.addEventListener?.("release", () => setAwake(false));
      } catch { setAwake(false); }
    }
    acquire();
    const onVisible = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      try { wakeLock.current?.release?.(); } catch { /* ignore */ }
    };
  }, []);

  async function move(order: KOrder, status: "new" | "preparing" | "served") {
    const prev = order.status;
    setError("");
    setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, status } : o))); // instant
    const { data, error: err } = await supabase.from("orders").update({ status }).eq("id", order.id).select("id");
    if (err || !data || data.length === 0) {
      setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, status: prev } : o)));
      setError("Couldn't update that order. Please try again.");
    }
  }

  function enableSound() {
    unlockAudioPlayback();
    setSoundOn(true);
  }
  function goFullscreen() {
    try { document.documentElement.requestFullscreen?.(); } catch { /* not supported */ }
  }

  const newOrders = orders.filter((o) => o.status === "new");
  const preparing = orders.filter((o) => o.status === "preparing");
  const served = orders
    .filter((o) => o.status === "served" && now - new Date(o.created_at).getTime() < SERVED_WINDOW_MS)
    .reverse()
    .slice(0, 12);

  const columns: { key: "new" | "preparing" | "served"; title: string; list: KOrder[]; action?: { label: string; to: "preparing" | "served" }; undo?: "new" | "preparing" }[] = [
    { key: "new", title: "New", list: newOrders, action: { label: "Start preparing", to: "preparing" } },
    { key: "preparing", title: "Preparing", list: preparing, action: { label: "Mark served", to: "served" }, undo: "new" },
    { key: "served", title: "Recently served", list: served, undo: "preparing" },
  ];

  return (
    <>
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">{restaurant?.name ?? "Live"}</p>
          <h1 className="panel-title">Kitchen</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={enableSound} className="kitchen-tool">
            <Bell size={14} /> {soundOn ? "Sound on ✓" : "Enable sound"}
          </button>
          <button onClick={toggleAutoPrint} className="kitchen-tool" aria-pressed={ap.enabled}>
            <Printer size={14} /> {ap.enabled ? "Auto-print on ✓" : "Auto-print off"}
          </button>
          {ap.enabled && (
            <button onClick={toggleWidth} className="kitchen-tool" title="Paper width">{ap.width} mm</button>
          )}
          <button onClick={goFullscreen} className="kitchen-tool">
            <Maximize size={14} /> Full screen
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 mb-3" role="alert">{error}</p>}
      {!awake && loaded && (
        <p className="text-xs text-inkSoft mb-3">Tip: your screen may sleep on this device. Turn off screen timeout while using the kitchen display.</p>
      )}

      {!loaded ? (
        <p className="text-sm text-inkSoft py-10 text-center">Loading orders…</p>
      ) : (
        <div className="kitchen-board">
          {columns.map((col) => (
            <section key={col.key} className={`kitchen-col kcol-${col.key}`}>
              <h2 className="kitchen-col-title">
                {col.title} <span>{col.list.length}</span>
              </h2>

              {col.list.length === 0 && (
                <div className="kitchen-empty">
                  {col.key === "new" ? <><ChefHat size={18} /> No new orders</> : "Nothing here"}
                </div>
              )}

              {col.list.map((o) => {
                const waitMs = now - new Date(o.created_at).getTime();
                const mins = waitMs / 60000;
                const urgency = col.key === "served" ? "" : mins >= LATE_MIN ? "late" : mins >= WARN_MIN ? "warn" : "";
                const time = new Date(o.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                return (
                  <article key={o.id} className={`kitchen-card ${urgency}`}>
                    <div className="kitchen-card-top">
                      <div>
                        <p className="kitchen-table">{o.qr_codes?.label ?? "Table"}</p>
                        <p className="kitchen-meta">#{o.id.slice(0, 6).toUpperCase()} · {time}</p>
                      </div>
                      <span className="kitchen-timer">{elapsedLabel(waitMs)}</span>
                    </div>

                    <div className="kitchen-items">
                      {o.order_items.length === 0 && <p className="kitchen-meta">Loading items…</p>}
                      {o.order_items.map((it, i) => (
                        <div key={i} className="kitchen-item">
                          <p><span className="kitchen-qty">{it.quantity}×</span> {it.dishes?.name ?? "Item"}</p>
                          {it.note && <p className="kitchen-note">Note: {it.note}</p>}
                        </div>
                      ))}
                    </div>

                    <div className="kitchen-actions">
                      {col.action && (
                        <button className="kitchen-btn primary" onClick={() => move(o, col.action!.to)}>
                          {col.action.label}
                        </button>
                      )}
                      {col.undo && (
                        <button className="kitchen-btn" onClick={() => move(o, col.undo!)}>
                          ← Back
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
