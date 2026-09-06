"use client";
import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useActiveRestaurant } from "@/lib/useActiveRestaurant";
import { Plus, Trash2, Pencil, UtensilsCrossed } from "lucide-react";

type Dish = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  photo_url: string | null;
  is_available: boolean;
};

function MenuPage() {
  const supabase = createClient();
  const { restaurant } = useActiveRestaurant();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Dish | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", photo_url: "" });

  async function loadDishes(rid: string) {
    const { data } = await supabase
      .from("dishes")
      .select("id, name, description, price, photo_url, is_available")
      .eq("restaurant_id", rid)
      .order("sort_order");
    setDishes(data ?? []);
  }

  useEffect(() => {
    if (restaurant) loadDishes(restaurant.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  function openNew() {
    setEditing(null);
    setForm({ name: "", description: "", price: "", photo_url: "" });
    setShowForm(true);
  }

  function openEdit(dish: Dish) {
    setEditing(dish);
    setForm({
      name: dish.name,
      description: dish.description ?? "",
      price: String(dish.price),
      photo_url: dish.photo_url ?? "",
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurant) return;
    const payload = {
      restaurant_id: restaurant.id,
      name: form.name,
      description: form.description,
      price: parseFloat(form.price || "0"),
      photo_url: form.photo_url,
    };
    if (editing) {
      await supabase.from("dishes").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("dishes").insert(payload);
    }
    setShowForm(false);
    loadDishes(restaurant.id);
  }

  async function handleDelete(id: string) {
    if (!restaurant) return;
    if (!confirm("Remove this dish from the menu?")) return;
    await supabase.from("dishes").delete().eq("id", id);
    loadDishes(restaurant.id);
  }

  async function toggleAvailable(dish: Dish) {
    if (!restaurant) return;
    await supabase.from("dishes").update({ is_available: !dish.is_available }).eq("id", dish.id);
    loadDishes(restaurant.id);
  }

  return (
    <>
        <div className="panel-header">
          <div>
            <p className="panel-eyebrow">{restaurant?.name ?? "Manage"}</p>
            <h1 className="panel-title">Menu</h1>
          </div>
          <button onClick={openNew} className="btn-gold flex items-center gap-2">
            <Plus size={15} /> Add dish
          </button>
        </div>

        <div className="space-y-2.5">
          {dishes.map((dish, i) => (
            <div key={dish.id} className="list-row fade-up" style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s` }}>
              {dish.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dish.photo_url} alt={dish.name} className="w-14 h-14 rounded-md object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-md bg-creamDeep flex items-center justify-center text-inkSoft">
                  <UtensilsCrossed size={18} strokeWidth={1.5} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{dish.name}</p>
                <p className="text-xs text-goldDeep mt-0.5 font-medium">₹{dish.price}</p>
              </div>
              <button
                onClick={() => toggleAvailable(dish)}
                className={`status-pill ${dish.is_available ? "status-new" : "status-cancelled"}`}
              >
                {dish.is_available ? "Available" : "Hidden"}
              </button>
              <button onClick={() => openEdit(dish)} className="p-2 text-inkSoft hover:text-ink transition-colors">
                <Pencil size={15} />
              </button>
              <button onClick={() => handleDelete(dish.id)} className="p-2 text-inkSoft hover:text-red-600 transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {dishes.length === 0 && (
            <div className="section-card text-center py-12">
              <p className="text-sm text-inkSoft">No dishes yet — add your first one.</p>
            </div>
          )}
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-6 z-50 backdrop-blur-sm">
            <form onSubmit={handleSave} className="section-card w-full max-w-md space-y-3">
              <h2 style={{ marginBottom: 4, fontSize: 20, fontFamily: "'Playfair Display', serif", fontWeight: 600, color: "#1E1B16", letterSpacing: 0, textTransform: "none" }}>
                {editing ? "Edit dish" : "Add dish"}
              </h2>
              <input
                required
                placeholder="Dish name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-ink/15 rounded-md px-3 py-2.5 text-sm bg-cream focus:outline-none focus:border-gold transition-colors"
              />
              <textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-ink/15 rounded-md px-3 py-2.5 text-sm bg-cream focus:outline-none focus:border-gold transition-colors"
              />
              <input
                required
                type="number"
                step="0.01"
                placeholder="Price"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full border border-ink/15 rounded-md px-3 py-2.5 text-sm bg-cream focus:outline-none focus:border-gold transition-colors"
              />
              <input
                placeholder="Photo URL"
                value={form.photo_url}
                onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                className="w-full border border-ink/15 rounded-md px-3 py-2.5 text-sm bg-cream focus:outline-none focus:border-gold transition-colors"
              />
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-gold flex-1 py-2.5">Save</button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 text-sm text-inkSoft border border-ink/15 rounded-full hover:bg-creamDeep transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </>
  );
}

export default function MenuPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-inkSoft">Loading...</div>}>
      <MenuPage />
    </Suspense>
  );
}
