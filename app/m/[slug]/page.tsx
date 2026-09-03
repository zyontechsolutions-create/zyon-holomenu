"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Script from "next/script";
import { createClient } from "@/lib/supabaseClient";

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

const ScanIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M12 2 2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

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
  const [orderPlaced, setOrderPlaced] = useState<string | null>(null);

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
    setOrderPlaced(order.id);
    setCart({});
    setPlacingOrder(false);
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

      <header className="site-header">
        <div className="corner" aria-hidden="true"></div>
        <div className="brand-eyebrow">ZYON <span>HOLOMENU</span></div>
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
      {cartCount > 0 && !orderPlaced && (
        <div className="cart-bar">
          <span style={{ fontSize: 13 }}>{cartCount} item{cartCount > 1 ? "s" : ""} · ₹{cartTotal.toFixed(0)}</span>
          <button onClick={placeOrder} disabled={placingOrder}>{placingOrder ? "Placing..." : "Place order"}</button>
        </div>
      )}

      {/* Order confirmation */}
      {orderPlaced && (
        <div className="ar-modal">
          <div className="ar-sheet" style={{ textAlign: "center", paddingTop: 32 }}>
            <h3>Order placed</h3>
            <p className="ar-note" style={{ marginBottom: 24 }}>Your order is on its way to the kitchen.</p>
            <button className="ar-launch" onClick={() => setOrderPlaced(null)}>Back to menu</button>
          </div>
        </div>
      )}
    </div>
  );
}
