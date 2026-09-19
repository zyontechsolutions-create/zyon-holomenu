"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Script from "next/script";
import { createClient } from "@/lib/supabaseClient";
import { playOrderChime } from "@/lib/notificationSound";

type Dish = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  photo_url: string | null;
  ar_enabled: boolean;
  ar_model_url: string | null;
  category_id: string | null;
  is_veg: boolean;
};
type Category = { id: string; name: string; sort_order: number };
type Restaurant = { id: string; name: string; upi_id: string | null };

function buildUpiLink(upiId: string, payeeName: string, amount: number, note: string) {
  const params = new URLSearchParams({ pa: upiId, pn: payeeName, am: amount.toFixed(2), cu: "INR", tn: note });
  return `upi://pay?${params.toString()}`;
}
type OrderSummaryItem = { name: string; qty: number; price: number; note?: string };

const ORDER_STEPS: { key: string; label: string }[] = [
  { key: "new", label: "Received" },
  { key: "preparing", label: "Preparing" },
  { key: "served", label: "Served" },
];

function OrderStepper({ status, compact }: { status: string; compact?: boolean }) {
  if (status === "cancelled") {
    return (
      <div style={{ display: "flex", justifyContent: "center" }}>
        <span className="status-pill status-cancelled">Cancelled</span>
      </div>
    );
  }
  const currentIndex = Math.max(0, ORDER_STEPS.findIndex((s) => s.key === status));
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
      {ORDER_STEPS.map((step, i) => {
        const done = i <= currentIndex;
        const isLast = i === ORDER_STEPS.length - 1;
        return (
          <div key={step.key} style={{ display: "flex", alignItems: "center", flex: isLast ? "0 0 auto" : "1 1 0" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: compact ? 20 : 62 }}>
              <div
                style={{
                  width: compact ? 14 : 22,
                  height: compact ? 14 : 22,
                  borderRadius: "50%",
                  background: done ? "#B8873F" : "rgba(30,27,22,0.14)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: compact ? 8 : 11,
                  fontWeight: 700,
                  flexShrink: 0,
                  transition: "background 0.3s ease",
                }}
              >
                {done ? "✓" : ""}
              </div>
              {!compact && (
                <span
                  style={{
                    fontSize: 10,
                    marginTop: 5,
                    color: done ? "#1E1B16" : "#a19a8c",
                    fontWeight: done ? 600 : 400,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  {step.label}
                </span>
              )}
            </div>
            {!isLast && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  minWidth: compact ? 10 : 16,
                  background: i < currentIndex ? "#B8873F" : "rgba(30,27,22,0.14)",
                  marginTop: compact ? 6 : 10,
                  transition: "background 0.3s ease",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StarRating({ value, onRate }: { value: number | null; onRate: (stars: number) => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onRate(n)}
          aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 26,
            lineHeight: 1,
            padding: 2,
            color: value && n <= value ? "#B8873F" : "rgba(30,27,22,0.2)",
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function VegDot({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? "#1c7a44" : "#b23b3b";
  return (
    <span
      title={isVeg ? "Veg" : "Non-veg"}
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        border: `1.5px solid ${color}`,
        borderRadius: 2,
        flexShrink: 0,
        verticalAlign: "middle",
        marginRight: 7,
      }}
    >
      <span
        style={{
          display: "block",
          width: isVeg ? 7 : 9,
          height: isVeg ? 7 : 8,
          margin: "2.5px auto",
          borderRadius: isVeg ? "50%" : 0,
          background: color,
          clipPath: isVeg ? undefined : "polygon(50% 0%, 0% 100%, 100% 100%)",
        }}
      />
    </span>
  );
}
type PlacedOrder = { id: string; items: OrderSummaryItem[]; total: number; status: string; rating: number | null; paid: boolean };
type HistoryOrder = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  items: OrderSummaryItem[];
  rating: number | null;
  paid: boolean;
};

const ScanIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M12 2 2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);
const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const STATUS_LABEL: Record<string, string> = {
  new: "Received",
  preparing: "Preparing",
  served: "Served",
  cancelled: "Cancelled",
};

function historyKey(slug: string) {
  return `holomenu-orders-${slug}`;
}
function getStoredOrderIds(slug: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(historyKey(slug)) ?? "[]");
  } catch {
    return [];
  }
}
function addStoredOrderId(slug: string, id: string) {
  const ids = getStoredOrderIds(slug);
  const next = [id, ...ids.filter((x) => x !== id)].slice(0, 20);
  localStorage.setItem(historyKey(slug), JSON.stringify(next));
}
function waiterKey(slug: string) {
  return `holomenu-waiter-${slug}`;
}
const WAITER_COOLDOWN_SECONDS = 60;

// A random, non-identifying token per device/browser — used only to know
// which device started a shared table cart, so it (and only it) can
// confirm the final order. Not tied to any real identity.
function getDeviceToken(): string {
  if (typeof window === "undefined") return "";
  const key = "holomenu-device-token";
  let token = localStorage.getItem(key);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(key, token);
  }
  return token;
}

export default function CustomerMenuPage() {
  const supabase = createClient();
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const tableId = searchParams.get("table");
  const modelViewerRef = useRef<any>(null);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [arDish, setArDish] = useState<Dish | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartNotes, setCartNotes] = useState<Record<string, string>>({});
  const [sharedCart, setSharedCart] = useState<Record<string, number>>({});
  const [sharedCartRaw, setSharedCartRaw] = useState<{ dish_id: string; quantity: number; device_token: string }[]>([]);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const deviceTokenRef = useRef<string>("");
  const [placingOrder, setPlacingOrder] = useState(false);

  const [showReview, setShowReview] = useState(false);
  const [lastOrder, setLastOrder] = useState<PlacedOrder | null>(null);
  const [splitSummary, setSplitSummary] = useState<Record<string, { label: string; subtotal: number; isMe: boolean }[]>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [historyOrders, setHistoryOrders] = useState<HistoryOrder[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [statusToast, setStatusToast] = useState<{ text: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knownStatusRef = useRef<Record<string, string>>({});
  const knownPaidRef = useRef<Record<string, boolean>>({});
  const [waiterCooldown, setWaiterCooldown] = useState(0);
  const [waiterConfirmed, setWaiterConfirmed] = useState(false);
  const waiterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lock background scroll whenever any full-screen overlay is open
  useEffect(() => {
    const anyModalOpen = showReview || !!arDish || showHistory || !!lastOrder;
    document.body.style.overflow = anyModalOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showReview, arDish, showHistory, lastOrder]);

  useEffect(() => {
    deviceTokenRef.current = getDeviceToken();
  }, []);

  // Shared table cart — only active when this menu was opened via a
  // table's QR code (tableId present). Every phone at the same table
  // reads and writes the same rows, kept in sync live.
  async function loadSharedCart() {
    if (!tableId) return;
    const { data } = await supabase
      .from("table_cart_items").select("dish_id, quantity, device_token").eq("qr_code_id", tableId);
    const next: Record<string, number> = {};
    data?.forEach((row) => { next[row.dish_id] = (next[row.dish_id] ?? 0) + row.quantity; });
    setSharedCart(next);
    setSharedCartRaw(data ?? []);
  }
  async function loadHostToken() {
    if (!tableId) return;
    const { data } = await supabase
      .from("table_sessions").select("host_token").eq("qr_code_id", tableId).maybeSingle();
    setHostToken(data?.host_token ?? null);
  }

  useEffect(() => {
    if (!tableId) return;
    loadSharedCart();
    loadHostToken();
    const channel = supabase
      .channel(`table-cart-${tableId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_cart_items", filter: `qr_code_id=eq.${tableId}` },
        () => loadSharedCart()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_sessions", filter: `qr_code_id=eq.${tableId}` },
        () => loadHostToken()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  function startWaiterCooldown(seconds: number) {
    setWaiterCooldown(seconds);
    if (waiterTimerRef.current) clearInterval(waiterTimerRef.current);
    waiterTimerRef.current = setInterval(() => {
      setWaiterCooldown((c) => {
        if (c <= 1) {
          if (waiterTimerRef.current) clearInterval(waiterTimerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  // Resume an in-progress cooldown after a refresh, instead of losing it
  useEffect(() => {
    const last = localStorage.getItem(waiterKey(slug));
    if (!last) return;
    const elapsed = Math.floor((Date.now() - Number(last)) / 1000);
    const remaining = WAITER_COOLDOWN_SECONDS - elapsed;
    if (remaining > 0) startWaiterCooldown(remaining);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    async function load() {
      const { data: r } = await supabase.from("restaurants").select("id, name, upi_id").eq("slug", slug).single();
      if (!r) { setLoading(false); return; }
      setRestaurant(r);

      const [{ data: cats }, { data: dishList }] = await Promise.all([
        supabase.from("categories").select("id, name, sort_order").eq("restaurant_id", r.id).order("sort_order"),
        supabase.from("dishes").select("id, name, description, price, photo_url, ar_enabled, ar_model_url, category_id, is_veg")
          .eq("restaurant_id", r.id).eq("is_available", true).order("sort_order"),
      ]);
      setCategories(cats ?? []);
      setDishes(dishList ?? []);
      if (cats && cats.length) setActiveCat(cats[0].id);
      setLoading(false);

      if (tableId) supabase.rpc("increment_qr_scan", { qr_id: tableId });

      // Log a real page visit (dish_id left null) so "Total Views" on the
      // dashboard reflects actual traffic, not just AR previews.
      supabase.from("menu_views").insert({ restaurant_id: r.id, dish_id: null, viewed_ar: false }).then(({ error }) => {
        if (error) console.error("menu_views insert failed:", error);
      });
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Live order status — updates "Order placed" and "My Orders" the moment
  // the kitchen changes a status, no refresh needed.
  useEffect(() => {
    if (!restaurant) return;
    const channel = supabase
      .channel(`customer-order-status-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` },
        (payload) => {
          const updated = payload.new as { id: string; status: string; paid: boolean };
          if (!getStoredOrderIds(slug).includes(updated.id)) return;

          setLastOrder((prev) => (prev && prev.id === updated.id ? { ...prev, status: updated.status, paid: updated.paid } : prev));
          setHistoryOrders((prev) =>
            prev.map((o) => (o.id === updated.id ? { ...o, status: updated.status, paid: updated.paid } : o))
          );

          const previousStatus = knownStatusRef.current[updated.id];
          const previousPaid = knownPaidRef.current[updated.id];
          knownStatusRef.current[updated.id] = updated.status;
          knownPaidRef.current[updated.id] = updated.paid;

          const statusChanged = previousStatus !== undefined && previousStatus !== updated.status;
          const justPaid = previousPaid === false && updated.paid === true;

          if (!statusChanged && !justPaid) return;

          setStatusToast({
            text: justPaid ? "Payment received — thank you!" : `Order ${STATUS_LABEL[updated.status] ?? updated.status}`,
          });
          playOrderChime();
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => setStatusToast(null), 4000);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (waiterTimerRef.current) clearInterval(waiterTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  async function logView(dish: Dish, viewedAr: boolean) {
    if (!restaurant) return;
    await supabase.from("menu_views").insert({ restaurant_id: restaurant.id, dish_id: dish.id, viewed_ar: viewedAr });
  }
  function openAr(dish: Dish) { setArDish(dish); logView(dish, true); }

  async function adjustSharedCart(dishId: string, delta: number) {
    if (!restaurant || !tableId) return;

    // Update the screen immediately for whoever tapped — don't make them
    // wait for a database round trip just to see their own tap register.
    // Other phones at the table still pick up the change via realtime,
    // same as before; this just removes the delay for the tapper.
    setSharedCart((c) => {
      const next = { ...c };
      const newQty = (next[dishId] ?? 0) + delta;
      if (newQty <= 0) delete next[dishId];
      else next[dishId] = newQty;
      return next;
    });

    // First device to add anything to an empty table becomes the host —
    // the only one allowed to confirm the final order for this round.
    if (delta > 0 && !hostToken) {
      setHostToken((h) => h ?? deviceTokenRef.current);
      await supabase.from("table_sessions").upsert(
        { restaurant_id: restaurant.id, qr_code_id: tableId, host_token: deviceTokenRef.current },
        { onConflict: "qr_code_id", ignoreDuplicates: true }
      );
    }
    await supabase.rpc("adjust_table_cart_item", {
      p_restaurant_id: restaurant.id,
      p_qr_code_id: tableId,
      p_dish_id: dishId,
      p_delta: delta,
      p_device_token: deviceTokenRef.current,
    });
  }

  function addToCart(id: string) {
    if (tableId) { adjustSharedCart(id, 1); return; }
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  }
  function removeFromCart(id: string) {
    if (tableId) { adjustSharedCart(id, -1); return; }
    setCart((c) => {
      const n = { ...c };
      if (n[id] > 1) n[id] -= 1;
      else {
        delete n[id];
        setCartNotes((notes) => { const nn = { ...notes }; delete nn[id]; return nn; });
      }
      return n;
    });
  }

  // Whichever cart is actually "active" right now — the shared table
  // cart if this menu was opened via QR, otherwise a private local one.
  const activeCart = tableId ? sharedCart : cart;
  const isHost = !tableId || (!!hostToken && hostToken === deviceTokenRef.current);

  async function clearSharedCart() {
    if (!tableId) return;
    await supabase.from("table_cart_items").delete().eq("qr_code_id", tableId);
    await supabase.from("table_sessions").delete().eq("qr_code_id", tableId);
    setSharedCart({});
    setHostToken(null);
  }

  const cartItems = useMemo(
    () => Object.entries(activeCart).map(([id, qty]) => ({ dish: dishes.find((d) => d.id === id)!, qty })).filter((i) => i.dish),
    [activeCart, dishes]
  );
  const cartTotal = cartItems.reduce((s, i) => s + i.dish.price * i.qty, 0);
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);

  async function loadSplit(orderId: string) {
    const { data } = await supabase
      .from("order_items")
      .select("dish_id, quantity, price_at_order, device_token")
      .eq("order_id", orderId)
      .not("device_token", "is", null);
    if (!data || data.length === 0) return;

    const totals: Record<string, number> = {};
    data.forEach((row: any) => {
      totals[row.device_token] = (totals[row.device_token] ?? 0) + row.quantity * Number(row.price_at_order);
    });
    // Stable ordering across every phone at the table, since it's based
    // purely on the token values themselves, not on who loaded this first.
    const tokens = Object.keys(totals).sort();
    const rows = tokens.map((token, i) => ({
      label: `Person ${i + 1}`,
      subtotal: totals[token],
      isMe: token === deviceTokenRef.current,
    }));
    setSplitSummary((s) => ({ ...s, [orderId]: rows }));
  }

  async function placeOrder() {
    if (!restaurant || cartItems.length === 0) return;
    if (tableId && !isHost) return;
    setPlacingOrder(true);
    const { data: order, error } = await supabase
      .from("orders").insert({ restaurant_id: restaurant.id, qr_code_id: tableId, total: cartTotal, status: "new" })
      .select("id").single();
    if (error || !order) { setPlacingOrder(false); return; }

    // In shared-table mode, keep each device's items as separate rows
    // (rather than one aggregated row per dish) so we can work out who
    // owes what afterward. A normal private order stays exactly as before.
    const orderItemRows = tableId
      ? sharedCartRaw.map((row) => ({
          order_id: order.id,
          dish_id: row.dish_id,
          quantity: row.quantity,
          price_at_order: dishes.find((d) => d.id === row.dish_id)?.price ?? 0,
          note: row.device_token === deviceTokenRef.current ? (cartNotes[row.dish_id]?.trim() || null) : null,
          device_token: row.device_token,
        }))
      : cartItems.map((i) => ({
          order_id: order.id,
          dish_id: i.dish.id,
          quantity: i.qty,
          price_at_order: i.dish.price,
          note: cartNotes[i.dish.id]?.trim() || null,
          device_token: null,
        }));
    await supabase.from("order_items").insert(orderItemRows);

    addStoredOrderId(slug, order.id);
    knownStatusRef.current[order.id] = "new";
    knownPaidRef.current[order.id] = false;
    setLastOrder({
      id: order.id,
      items: cartItems.map((i) => ({ name: i.dish.name, qty: i.qty, price: i.dish.price, note: cartNotes[i.dish.id]?.trim() || undefined })),
      total: cartTotal,
      status: "new",
      rating: null,
      paid: false,
    });
    if (tableId) {
      await loadSplit(order.id);
      await clearSharedCart();
    } else {
      setCart({});
    }
    setCartNotes({});
    setShowReview(false);
    setPlacingOrder(false);
  }

  async function callWaiter() {
    if (!restaurant || waiterCooldown > 0) return;
    setWaiterConfirmed(true);
    localStorage.setItem(waiterKey(slug), String(Date.now()));
    startWaiterCooldown(WAITER_COOLDOWN_SECONDS);
    setTimeout(() => setWaiterConfirmed(false), 4000);
    await supabase.from("waiter_calls").insert({ restaurant_id: restaurant.id, qr_code_id: tableId, status: "pending" });
  }

  async function openHistory() {
    setShowHistory(true);
    setHistoryLoading(true);
    const ids = getStoredOrderIds(slug);
    if (ids.length === 0) { setHistoryOrders([]); setHistoryLoading(false); return; }

    const { data } = await supabase
      .from("orders")
      .select("id, status, total, created_at, paid, rating, order_items(quantity, price_at_order, dishes(name))")
      .in("id", ids)
      .order("created_at", { ascending: false });

    const mapped: HistoryOrder[] = (data ?? []).map((o: any) => ({
      id: o.id,
      status: o.status,
      total: o.total,
      created_at: o.created_at,
      rating: o.rating ?? null,
      paid: !!o.paid,
      items: (o.order_items ?? []).map((it: any) => ({
        name: it.dishes?.name ?? "Unknown dish",
        qty: it.quantity,
        price: it.price_at_order,
      })),
    }));
    setHistoryOrders(mapped);
    mapped.forEach((o) => { knownStatusRef.current[o.id] = o.status; });
    (data ?? []).forEach((o: any) => { knownPaidRef.current[o.id] = !!o.paid; });
    setHistoryLoading(false);
  }

  async function submitRating(orderId: string, stars: number) {
    // Update instantly, don't make the customer wait to see their tap register.
    setLastOrder((prev) => (prev && prev.id === orderId ? { ...prev, rating: stars } : prev));
    setHistoryOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, rating: stars } : o)));
    await supabase.from("orders").update({ rating: stars, rated_at: new Date().toISOString() }).eq("id", orderId);
  }

  const grouped = categories.map((cat) => ({ ...cat, items: dishes.filter((d) => d.category_id === cat.id) }))
    .filter((c) => c.items.length > 0);
  const uncategorized = dishes.filter((d) => !d.category_id);
  const sections = [...grouped, ...(uncategorized.length ? [{ id: "other", name: "More", sort_order: 999, items: uncategorized }] : [])];
  const heroDish = dishes.find((d) => d.photo_url) ?? null;

  if (loading) return <div className="min-h-screen flex items-center justify-center text-inkSoft text-sm">Loading menu...</div>;
  if (!restaurant) return <div className="min-h-screen flex items-center justify-center text-inkSoft text-sm">Menu not found.</div>;

  return (
    <div className="wrap" style={{ paddingBottom: cartCount > 0 ? 88 : 0 }}>
      <Script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js" strategy="afterInteractive" />

      {statusToast && (
        <div className="status-toast" onClick={() => setStatusToast(null)}>
          <span className="dot" />
          {statusToast.text}
        </div>
      )}

      <header className="site-header">
        <div className="brand-block">
          <div className="corner" aria-hidden="true"></div>
          <div className="brand-eyebrow">ZYON <span>HOLOMENU</span></div>
        </div>
        <button className="my-orders-btn" onClick={openHistory}>
          <ClockIcon /> My Orders
        </button>
      </header>

      <button
        className="call-waiter-fab"
        onClick={callWaiter}
        disabled={waiterCooldown > 0}
        aria-label="Call waiter"
      >
        <BellIcon />
        {waiterCooldown > 0 ? `Sent (${waiterCooldown}s)` : "Call Waiter"}
      </button>

      {waiterConfirmed && (
        <div className="status-toast" style={{ top: 64 }}>
          <span className="dot" />
          Staff notified — someone's on the way
        </div>
      )}

      <section className="hero">
        {heroDish && (
          <div className="hero-photo" style={{ backgroundImage: `url('${heroDish.photo_url}')` }} role="img" aria-label={heroDish.name}>
            <p className="plate-caption">Featured — {heroDish.name}</p>
          </div>
        )}
        <h1>{restaurant.name}</h1>
        <p className="tagline">See the food before it arrives.</p>
        <div className="divider-hero"></div>
        <p className="hero-sub">
          Browse the menu below. Tap <strong>View on Table</strong> on any dish to preview it in AR —
          true to size, true to presentation — then order straight from your phone.
        </p>
      </section>

      {sections.length > 1 && (
        <nav className="category-nav">
          {sections.map((s) => (
            <button
              key={s.id}
              className={`cat-pill ${activeCat === s.id ? "active" : ""}`}
              onClick={() => {
                setActiveCat(s.id);
                document.getElementById(`sec-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {s.name}
            </button>
          ))}
        </nav>
      )}

      <main className="menu">
        {sections.map((section) => (
          <section key={section.id} className="menu-section" id={`sec-${section.id}`}>
            <div className="section-heading">
              <h2>{section.name}</h2>
              <span className="count">{section.items.length} dish{section.items.length !== 1 ? "es" : ""}</span>
            </div>

            {section.items.map((dish, i) => (
              <article key={dish.id} className="dish-card" style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}>
                <div className="dish-photo" style={dish.photo_url ? { backgroundImage: `url('${dish.photo_url}')` } : {}} />
                <div className="dish-info">
                  <h3><VegDot isVeg={dish.is_veg} />{dish.name}</h3>
                  {dish.description && <p>{dish.description}</p>}
                  <div className="dish-actions">
                    <span className="price">₹{dish.price}</span>
                    <div className="action-btns">
                      {dish.ar_enabled && dish.ar_model_url && (
                        <button className="btn-chip ar" onClick={() => openAr(dish)}>
                          <ScanIcon /> View on Table
                        </button>
                      )}
                      {activeCart[dish.id] ? (
                        <span className="qty-chip">
                          <button onClick={() => removeFromCart(dish.id)}>−</button>
                          <span style={{ fontSize: 12, minWidth: 12, textAlign: "center" }}>{activeCart[dish.id]}</span>
                          <button onClick={() => addToCart(dish.id)}>+</button>
                        </span>
                      ) : (
                        <button className="btn-chip order" onClick={() => addToCart(dish.id)}>Add</button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ))}
        {dishes.length === 0 && <p style={{ fontSize: 14, color: "#6b6455", padding: "24px 0" }}>This menu isn&apos;t set up yet.</p>}
      </main>

      <footer className="menu-footer">
        <div className="footer-brand">{restaurant.name}<span>POWERED BY ZYON HOLOMENU</span></div>
        <p className="footer-note">Every dish on this menu can be previewed true to size, right on your table, before you order.</p>
        <hr className="footer-rule" />
        <div className="footer-meta">
          Zyon Tech Solutions · <a href="/terms" style={{ color: "inherit" }}>Terms</a> · <a href="/privacy" style={{ color: "inherit" }}>Privacy</a> · <a href="/support" style={{ color: "inherit" }}>Support</a>
        </div>
      </footer>

      {/* AR bottom sheet */}
      {arDish && (
        <div className="ar-modal" onClick={(e) => { if (e.target === e.currentTarget) setArDish(null); }}>
          <div className="ar-sheet">
            <button className="ar-close" onClick={() => setArDish(null)}>×</button>
            <div className="ar-visual">
              <span className="ar-badge"><ScanIcon /> AR</span>
              {/* @ts-ignore */}
              <model-viewer
                ref={modelViewerRef}
                src={arDish.ar_model_url}
                camera-controls
                auto-rotate
                style={{ width: "100%", height: "100%" }}
              />
              {/* @ts-ignore */}
            </div>
            <h3>{arDish.name}</h3>
            <p className="ar-note">True to size · True to presentation</p>
            <button className="ar-launch" onClick={() => modelViewerRef.current?.activateAR?.()}>
              View on Table
            </button>
            <p className="ar-hint">Point your camera at a flat surface to place the dish.</p>
          </div>
        </div>
      )}

      {/* Cart bar */}
      {cartCount > 0 && !showReview && (
        <div className="cart-bar">
          <span style={{ fontSize: 13 }}>
            {cartCount} item{cartCount > 1 ? "s" : ""} · ₹{cartTotal.toFixed(0)}
            {tableId && !isHost && <span style={{ display: "block", fontSize: 10.5, opacity: 0.75, marginTop: 2 }}>Shared table cart</span>}
          </span>
          <button onClick={() => setShowReview(true)}>Review order</button>
        </div>
      )}

      {/* Review order — must confirm here before it's actually sent */}
      {showReview && (
        <div className="ar-modal" onClick={(e) => { if (e.target === e.currentTarget) setShowReview(false); }}>
          <div className="ar-sheet" style={{ paddingTop: 28 }}>
            <button className="ar-close" onClick={() => setShowReview(false)}>×</button>
            <h3 style={{ textAlign: "center" }}>Review your order</h3>
            <p className="ar-note" style={{ textAlign: "center", marginBottom: 18 }}>
              {tableId && !isHost
                ? "Everyone at this table shares this cart — add whatever you like."
                : "Check everything before it goes to the kitchen."}
            </p>
            <div className="history-list" style={{ maxHeight: "40vh" }}>
              {cartItems.map((item) => (
                <div key={item.dish.id} style={{ marginBottom: 10 }}>
                  <div className="history-item-row" style={{ alignItems: "center" }}>
                    <span><VegDot isVeg={item.dish.is_veg} />{item.dish.name}</span>
                    <span className="qty-chip">
                      <button onClick={() => removeFromCart(item.dish.id)}>−</button>
                      <span style={{ fontSize: 12, minWidth: 12, textAlign: "center" }}>{item.qty}</span>
                      <button onClick={() => addToCart(item.dish.id)}>+</button>
                    </span>
                    <span>₹{(item.dish.price * item.qty).toFixed(0)}</span>
                  </div>
                  <input
                    value={cartNotes[item.dish.id] ?? ""}
                    onChange={(e) => setCartNotes((n) => ({ ...n, [item.dish.id]: e.target.value }))}
                    placeholder="Add a note (e.g. no onions, extra spicy)"
                    maxLength={140}
                    style={{
                      width: "100%",
                      marginTop: 4,
                      fontSize: 12,
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(30,27,22,0.15)",
                      background: "rgba(30,27,22,0.03)",
                      color: "#1E1B16",
                    }}
                  />
                </div>
              ))}
              {cartItems.length === 0 && (
                <p className="ar-note" style={{ textAlign: "center" }}>Your cart is empty.</p>
              )}
              <div className="history-total">
                <span>Total</span>
                <span>₹{cartTotal.toFixed(0)}</span>
              </div>
            </div>
            {tableId && !isHost ? (
              <p className="ar-note" style={{ textAlign: "center", margin: "8px 0" }}>
                Only the person who started this table's order can confirm it. Ask them to tap Confirm on their
                phone, or clear the cart below to start a fresh order yourself.
              </p>
            ) : null}
            <button
              className="ar-launch"
              onClick={placeOrder}
              disabled={placingOrder || cartItems.length === 0 || (!!tableId && !isHost)}
            >
              {placingOrder ? "Placing..." : "Confirm order"}
            </button>
            {tableId && cartItems.length > 0 && (
              <button
                className="ar-hint"
                style={{ background: "none", border: "none", width: "100%", textAlign: "center", marginTop: 8, cursor: "pointer", fontSize: 11.5, opacity: 0.7 }}
                onClick={() => {
                  if (confirm("Clear this table's cart for everyone and start a fresh order?")) clearSharedCart();
                }}
              >
                Clear cart & start over
              </button>
            )}
            <button
              className="ar-hint"
              style={{ background: "none", border: "none", width: "100%", textAlign: "center", marginTop: 10, cursor: "pointer" }}
              onClick={() => setShowReview(false)}
            >
              ← Back to menu, keep editing
            </button>
          </div>
        </div>
      )}


      {/* Order confirmation — now itemized */}
      {lastOrder && (
        <div className="ar-modal">
          <div className="ar-sheet" style={{ paddingTop: 28 }}>
            <h3 style={{ textAlign: "center" }}>Order placed</h3>
            <div style={{ margin: "14px 0 20px" }}>
              <OrderStepper status={lastOrder.status} />
            </div>
            <div className="history-list" style={{ maxHeight: "40vh" }}>
              {lastOrder.items.map((item, idx) => (
                <div key={idx}>
                  <div className="history-item-row">
                    <span>{item.qty}× {item.name}</span>
                    <span>₹{(item.qty * item.price).toFixed(0)}</span>
                  </div>
                  {item.note && <p className="ar-note" style={{ fontSize: 11.5, margin: "-2px 0 6px" }}>Note: {item.note}</p>}
                </div>
              ))}
              <div className="history-total">
                <span>Total</span>
                <span>₹{lastOrder.total.toFixed(0)}</span>
              </div>
            </div>
            {splitSummary[lastOrder.id] && splitSummary[lastOrder.id].length > 1 && (
              <div style={{ margin: "14px 0 4px", padding: "12px 14px", background: "rgba(184,135,63,0.07)", borderRadius: 10 }}>
                <p className="ar-note" style={{ fontWeight: 600, marginBottom: 8, color: "#1E1B16" }}>Split the bill</p>
                {splitSummary[lastOrder.id].map((row) => (
                  <div key={row.label} className="history-item-row" style={{ fontSize: 13 }}>
                    <span>{row.label}{row.isMe ? " (You)" : ""}</span>
                    <span>₹{row.subtotal.toFixed(0)}</span>
                  </div>
                ))}
                <p className="ar-note" style={{ fontSize: 11, marginTop: 8 }}>
                  Everyone pays the host directly (cash or UPI) — the restaurant only sees one payment for the
                  whole table.
                </p>
              </div>
            )}
            {lastOrder.status === "served" && (
              <div style={{ textAlign: "center", margin: "18px 0 4px" }}>
                <p className="ar-note" style={{ marginBottom: 8 }}>
                  {lastOrder.rating ? "Thanks for rating!" : "How was it?"}
                </p>
                <StarRating value={lastOrder.rating} onRate={(stars) => submitRating(lastOrder.id, stars)} />
              </div>
            )}
            {restaurant.upi_id && !lastOrder.paid && (
              <a
                href={buildUpiLink(restaurant.upi_id, restaurant.name, lastOrder.total, `Order ${lastOrder.id.slice(0, 8)}`)}
                className="ar-launch"
                style={{ display: "block", textAlign: "center", textDecoration: "none", marginBottom: 10 }}
              >
                Pay ₹{lastOrder.total.toFixed(0)} via UPI
              </a>
            )}
            {restaurant.upi_id && lastOrder.paid && (
              <p className="ar-note" style={{ textAlign: "center", color: "#1c7a44", fontWeight: 600, marginBottom: 10 }}>
                ✓ Payment received
              </p>
            )}
            <button className="ar-launch" onClick={() => setLastOrder(null)}>Back to menu</button>
          </div>
        </div>
      )}

      {/* My Orders history */}
      {showHistory && (
        <div className="ar-modal" onClick={(e) => { if (e.target === e.currentTarget) setShowHistory(false); }}>
          <div className="ar-sheet" style={{ paddingTop: 28 }}>
            <button className="ar-close" onClick={() => setShowHistory(false)}>×</button>
            <h3 style={{ marginBottom: 18 }}>My Orders</h3>
            {historyLoading ? (
              <p className="ar-note">Loading...</p>
            ) : historyOrders.length === 0 ? (
              <p className="ar-note">No orders placed yet on this device.</p>
            ) : (
              <div className="history-list">
                {historyOrders.map((o) => (
                  <div key={o.id} className="history-order">
                    <div className="history-order-head">
                      <OrderStepper status={o.status} compact />
                      <span className="when">{new Date(o.created_at).toLocaleString()}</span>
                    </div>
                    {o.items.map((item, idx) => (
                      <div key={idx} className="history-item-row">
                        <span>{item.qty}× {item.name}</span>
                        <span>₹{(item.qty * item.price).toFixed(0)}</span>
                      </div>
                    ))}
                    <div className="history-total">
                      <span>Total</span>
                      <span>₹{o.total}</span>
                    </div>
                    {restaurant.upi_id && o.status !== "cancelled" && !o.paid && (
                      <a
                        href={buildUpiLink(restaurant.upi_id, restaurant.name, o.total, `Order ${o.id.slice(0, 8)}`)}
                        className="ar-launch"
                        style={{ textDecoration: "none", marginTop: 10 }}
                      >
                        Pay ₹{o.total.toFixed(0)} via UPI
                      </a>
                    )}
                    {restaurant.upi_id && o.paid && (
                      <p className="ar-note" style={{ textAlign: "center", color: "#1c7a44", fontWeight: 600, marginTop: 10 }}>
                        ✓ Payment received
                      </p>
                    )}
                    {o.status === "served" && (
                      <div style={{ textAlign: "center", marginTop: 12 }}>
                        <p className="ar-note" style={{ fontSize: 11.5, marginBottom: 4 }}>
                          {o.rating ? "Thanks for rating!" : "Rate this order"}
                        </p>
                        <StarRating value={o.rating} onRate={(stars) => submitRating(o.id, stars)} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
