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
};
type Category = { id: string; name: string; sort_order: number };
type Restaurant = { id: string; name: string };
type OrderSummaryItem = { name: string; qty: number; price: number };
type PlacedOrder = { id: string; items: OrderSummaryItem[]; total: number; status: string };
type HistoryOrder = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  items: OrderSummaryItem[];
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
  const [placingOrder, setPlacingOrder] = useState(false);

  const [showReview, setShowReview] = useState(false);
  const [lastOrder, setLastOrder] = useState<PlacedOrder | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyOrders, setHistoryOrders] = useState<HistoryOrder[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [statusToast, setStatusToast] = useState<{ status: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      const { data: r } = await supabase.from("restaurants").select("id, name").eq("slug", slug).single();
      if (!r) { setLoading(false); return; }
      setRestaurant(r);

      const [{ data: cats }, { data: dishList }] = await Promise.all([
        supabase.from("categories").select("id, name, sort_order").eq("restaurant_id", r.id).order("sort_order"),
        supabase.from("dishes").select("id, name, description, price, photo_url, ar_enabled, ar_model_url, category_id")
          .eq("restaurant_id", r.id).eq("is_available", true).order("sort_order"),
      ]);
      setCategories(cats ?? []);
      setDishes(dishList ?? []);
      if (cats && cats.length) setActiveCat(cats[0].id);
      setLoading(false);

      if (tableId) supabase.rpc("increment_qr_scan", { qr_id: tableId });
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
          const updated = payload.new as { id: string; status: string };
          if (!getStoredOrderIds(slug).includes(updated.id)) return;

          setLastOrder((prev) => (prev && prev.id === updated.id ? { ...prev, status: updated.status } : prev));
          setHistoryOrders((prev) =>
            prev.map((o) => (o.id === updated.id ? { ...o, status: updated.status } : o))
          );

          // Pop up a toast regardless of which screen the customer is on.
          setStatusToast({ status: updated.status });
          playOrderChime();
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => setStatusToast(null), 4000);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  async function logView(dish: Dish, viewedAr: boolean) {
    if (!restaurant) return;
    await supabase.from("menu_views").insert({ restaurant_id: restaurant.id, dish_id: dish.id, viewed_ar: viewedAr });
  }
  function openAr(dish: Dish) { setArDish(dish); logView(dish, true); }
  function addToCart(id: string) { setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 })); }
  function removeFromCart(id: string) {
    setCart((c) => { const n = { ...c }; if (n[id] > 1) n[id] -= 1; else delete n[id]; return n; });
  }

  const cartItems = useMemo(
    () => Object.entries(cart).map(([id, qty]) => ({ dish: dishes.find((d) => d.id === id)!, qty })).filter((i) => i.dish),
    [cart, dishes]
  );
  const cartTotal = cartItems.reduce((s, i) => s + i.dish.price * i.qty, 0);
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);

  async function placeOrder() {
    if (!restaurant || cartItems.length === 0) return;
    setPlacingOrder(true);
    const { data: order, error } = await supabase
      .from("orders").insert({ restaurant_id: restaurant.id, qr_code_id: tableId, total: cartTotal, status: "new" })
      .select("id").single();
    if (error || !order) { setPlacingOrder(false); return; }
    await supabase.from("order_items").insert(
      cartItems.map((i) => ({ order_id: order.id, dish_id: i.dish.id, quantity: i.qty, price_at_order: i.dish.price }))
    );

    addStoredOrderId(slug, order.id);
    setLastOrder({
      id: order.id,
      items: cartItems.map((i) => ({ name: i.dish.name, qty: i.qty, price: i.dish.price })),
      total: cartTotal,
      status: "new",
    });
    setCart({});
    setShowReview(false);
    setPlacingOrder(false);
  }

  async function openHistory() {
    setShowHistory(true);
    setHistoryLoading(true);
    const ids = getStoredOrderIds(slug);
    if (ids.length === 0) { setHistoryOrders([]); setHistoryLoading(false); return; }

    const { data } = await supabase
      .from("orders")
      .select("id, status, total, created_at, order_items(quantity, price_at_order, dishes(name))")
      .in("id", ids)
      .order("created_at", { ascending: false });

    const mapped: HistoryOrder[] = (data ?? []).map((o: any) => ({
      id: o.id,
      status: o.status,
      total: o.total,
      created_at: o.created_at,
      items: (o.order_items ?? []).map((it: any) => ({
        name: it.dishes?.name ?? "Unknown dish",
        qty: it.quantity,
        price: it.price_at_order,
      })),
    }));
    setHistoryOrders(mapped);
    setHistoryLoading(false);
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
          Order {STATUS_LABEL[statusToast.status] ?? statusToast.status}
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
                  <h3>{dish.name}</h3>
                  {dish.description && <p>{dish.description}</p>}
                  <div className="dish-actions">
                    <span className="price">₹{dish.price}</span>
                    <div className="action-btns">
                      {dish.ar_enabled && dish.ar_model_url && (
                        <button className="btn-chip ar" onClick={() => openAr(dish)}>
                          <ScanIcon /> View on Table
                        </button>
                      )}
                      {cart[dish.id] ? (
                        <span className="qty-chip">
                          <button onClick={() => removeFromCart(dish.id)}>−</button>
                          <span style={{ fontSize: 12, minWidth: 12, textAlign: "center" }}>{cart[dish.id]}</span>
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
        <div className="footer-meta">Zyon Tech Solutions</div>
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
          <span style={{ fontSize: 13 }}>{cartCount} item{cartCount > 1 ? "s" : ""} · ₹{cartTotal.toFixed(0)}</span>
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
              Check everything before it goes to the kitchen.
            </p>
            <div className="history-list" style={{ maxHeight: "40vh" }}>
              {cartItems.map((item) => (
                <div key={item.dish.id} className="history-item-row" style={{ alignItems: "center" }}>
                  <span>{item.dish.name}</span>
                  <span className="qty-chip">
                    <button onClick={() => removeFromCart(item.dish.id)}>−</button>
                    <span style={{ fontSize: 12, minWidth: 12, textAlign: "center" }}>{item.qty}</span>
                    <button onClick={() => addToCart(item.dish.id)}>+</button>
                  </span>
                  <span>₹{(item.dish.price * item.qty).toFixed(0)}</span>
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
            <button
              className="ar-launch"
              onClick={placeOrder}
              disabled={placingOrder || cartItems.length === 0}
            >
              {placingOrder ? "Placing..." : "Confirm order"}
            </button>
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
            <div style={{ display: "flex", justifyContent: "center", margin: "10px 0 18px" }}>
              <span className={`status-pill status-${lastOrder.status === "new" ? "new" : lastOrder.status === "served" ? "served" : lastOrder.status === "cancelled" ? "cancelled" : "preparing"}`}>
                {STATUS_LABEL[lastOrder.status] ?? lastOrder.status}
              </span>
            </div>
            <div className="history-list" style={{ maxHeight: "40vh" }}>
              {lastOrder.items.map((item, idx) => (
                <div key={idx} className="history-item-row">
                  <span>{item.qty}× {item.name}</span>
                  <span>₹{(item.qty * item.price).toFixed(0)}</span>
                </div>
              ))}
              <div className="history-total">
                <span>Total</span>
                <span>₹{lastOrder.total.toFixed(0)}</span>
              </div>
            </div>
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
                      <span className={`status-pill status-${o.status === "new" ? "new" : o.status === "served" ? "served" : o.status === "cancelled" ? "cancelled" : "preparing"}`}
                        style={{ fontSize: 10, padding: "5px 11px" }}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
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
