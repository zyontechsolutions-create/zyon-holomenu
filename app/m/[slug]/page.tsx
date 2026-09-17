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
type PlacedOrder = { id: string; items: OrderSummaryItem[]; total: number; status: string; rating: number | null };
type HistoryOrder = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  items: OrderSummaryItem[];
  rating: number | null;
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

const STEP_ORDER = ["new", "preparing", "served"];

function OrderStatusStepper({ status, compact = false }: { status: string; compact?: boolean }) {
  if (status === "cancelled") {
    return (
      <div style={{ textAlign: compact ? "left" : "center", margin: compact ? "0 0 8px" : "10px 0 18px" }}>
        <span className="status-pill status-cancelled" style={compact ? { fontSize: 10, padding: "5px 11px" } : undefined}>
          {STATUS_LABEL.cancelled}
        </span>
      </div>
    );
  }

  const currentIndex = Math.max(STEP_ORDER.indexOf(status), 0);
  const circleSize = compact ? 13 : 20;

  return (
    <div style={{ display: "flex", margin: compact ? "4px 0 10px" : "14px 0 22px" }}>
      {STEP_ORDER.map((key, i) => {
        const done = i <= currentIndex;
        return (
          <div key={key} style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {i > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: circleSize / 2 - 1,
                  left: "-50%",
                  width: "100%",
                  height: 2,
                  background: done ? "#1E1B16" : "rgba(30,27,22,0.15)",
                  zIndex: 0,
                }}
              />
            )}
            <div
              style={{
                width: circleSize,
                height: circleSize,
                borderRadius: "50%",
                background: done ? "#1E1B16" : "#F5F0E4",
                border: `2px solid ${done ? "#1E1B16" : "rgba(30,27,22,0.25)"}`,
                zIndex: 1,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: compact ? 9 : 11,
                marginTop: compact ? 4 : 6,
                color: done ? "#1E1B16" : "#6b6455",
                fontWeight: i === currentIndex ? 600 : 400,
                textAlign: "center",
              }}
            >
              {STATUS_LABEL[key]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

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
  const [hostToken, setHostToken] = useState<string | null>(null);
  const deviceTokenRef = useRef<string>("");
  const [placingOrder, setPlacingOrder] = useState(false);

  const [showReview, setShowReview] = useState(false);
  const [lastOrder, setLastOrder] = useState<PlacedOrder | null>(null);
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
      .from("table_cart_items").select("dish_id, quantity").eq("qr_code_id", tableId);
    const next: Record<string, number> = {};
    data?.forEach((row) => { next[row.dish_id] = row.quantity; });
    setSharedCart(next);
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

          setLastOrder((prev) => (prev && prev.id === updated.id ? { ...prev, status: updated.status } : prev));
          setHistoryOrders((prev) =>
            prev.map((o) => (o.id === updated.id ? { ...o, status: updated.status } : o))
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

  async function placeOrder() {
    if (!restaurant || cartItems.length === 0) return;
    if (tableId && !isHost) return;
    setPlacingOrder(true);
    const { data: order, error } = await supabase
      .from("orders").insert({ restaurant_id: restaurant.id, qr_code_id: tableId, total: cartTotal, status: "new" })
      .select("id").single();
    if (error || !order) { setPlacingOrder(false); return; }
    await supabase.from("order_items").insert(
      cartItems.map((i) => ({
        order_id: order.id,
        dish_id: i.dish.id,
        quantity: i.qty,
        price_at_order: i.dish.price,
        note: cartNotes[i.dish.id]?.trim() || null,
      }))
    );

    addStoredOrderId(slug, order.id);
    knownStatusRef.current[order.id] = "new";
    knownPaidRef.current[order.id] = false;
    setLastOrder({
      id: order.id,
      items: cartItems.map((i) => ({ name: i.dish.name, qty: i.qty, price: i.dish.price, note: cartNotes[i.dish.id]?.trim() || undefined })),
      total: cartTotal,
      status: "new",
      rating: null,
    });
    if (tableId) {
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
            <OrderStatusStepper status={lastOrder.status} />
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
            {lastOrder.status === "served" && (
              <div style={{ textAlign: "center", margin: "18px 0 4px" }}>
                <p className="ar-note" style={{ marginBottom: 8 }}>
                  {lastOrder.rating ? "Thanks for rating!" : "How was it?"}
                </p>
                <StarRating value={lastOrder.rating} onRate={(stars) => submitRating(lastOrder.id, stars)} />
              </div>
            )}
            {restaurant.upi_id && (
              
                href={buildUpiLink(restaurant.upi_id, restaurant.name, lastOrder.total, `Order ${lastOrder.id.slice(0, 8)}`)}
                className="ar-launch"
                style={{ display: "block", textAlign: "center", textDecoration: "none", marginBottom: 10 }}
              >
                Pay ₹{lastOrder.total.toFixed(0)} via UPI
              </a>
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
                      <span className="when" style={{ marginLeft: "auto" }}>{new Date(o.created_at).toLocaleString()}</span>
                    </div>
                    <OrderStatusStepper status={o.status} compact />
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
                    {restaurant.upi_id && o.status !== "cancelled" && (
                      
                        href={buildUpiLink(restaurant.upi_id, restaurant.name, o.total, `Order ${o.id.slice(0, 8)}`)}
                        className="ar-launch"
                        style={{ textDecoration: "none", marginTop: 10 }}
                      >
                        Pay ₹{o.total.toFixed(0)} via UPI
                      </a>
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
