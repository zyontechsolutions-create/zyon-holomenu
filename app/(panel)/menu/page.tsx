"use client";
import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useActiveRestaurant } from "@/lib/useActiveRestaurant";
import { Plus, Trash2, Pencil, UtensilsCrossed, Upload, Loader2, X, Box } from "lucide-react";

type Dish = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  photo_url: string | null;
  is_available: boolean;
  category_id: string | null;
  is_veg: boolean;
  ar_enabled: boolean;
  ar_model_url: string | null;
};
type Category = { id: string; name: string; sort_order: number };

function MenuPage() {
  const supabase = createClient();
  const { restaurant } = useActiveRestaurant();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Dish | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", photo_url: "", category_id: "", is_veg: true, ar_enabled: false, ar_model_url: "" });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadingModel, setUploadingModel] = useState(false);
  const [modelError, setModelError] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  async function loadDishes(rid: string) {
    const { data } = await supabase
      .from("dishes")
      .select("id, name, description, price, photo_url, is_available, category_id, is_veg, ar_enabled, ar_model_url")
      .eq("restaurant_id", rid)
      .order("sort_order");
    setDishes(data ?? []);
  }

  async function loadCategories(rid: string) {
    const { data } = await supabase
      .from("categories")
      .select("id, name, sort_order")
      .eq("restaurant_id", rid)
      .order("sort_order");
    setCategories(data ?? []);
  }

  useEffect(() => {
    if (restaurant) {
      loadDishes(restaurant.id);
      loadCategories(restaurant.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurant || !newCategoryName.trim()) return;
    setSavingCategory(true);
    await supabase.from("categories").insert({
      restaurant_id: restaurant.id,
      name: newCategoryName.trim(),
      sort_order: categories.length,
    });
    setNewCategoryName("");
    setSavingCategory(false);
    loadCategories(restaurant.id);
  }

  async function deleteCategory(id: string) {
    if (!restaurant) return;
    if (!confirm("Delete this category? Dishes in it won't be deleted, just uncategorized.")) return;
    await supabase.from("categories").delete().eq("id", id);
    loadCategories(restaurant.id);
    loadDishes(restaurant.id);
  }

  function openNew() {
    setEditing(null);
    setForm({ name: "", description: "", price: "", photo_url: "", category_id: "", is_veg: true, ar_enabled: false, ar_model_url: "" });
    setUploadError("");
    setModelError("");
    setShowForm(true);
  }

  function openEdit(dish: Dish) {
    setEditing(dish);
    setForm({
      name: dish.name,
      description: dish.description ?? "",
      price: String(dish.price),
      photo_url: dish.photo_url ?? "",
      category_id: dish.category_id ?? "",
      is_veg: dish.is_veg,
      ar_enabled: dish.ar_enabled,
      ar_model_url: dish.ar_model_url ?? "",
    });
    setUploadError("");
    setModelError("");
    setShowForm(true);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || !restaurant) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image is too large — please use one under 5MB.");
      return;
    }

    setUploading(true);
    setUploadError("");
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "-");
    const path = `${restaurant.id}/${Date.now()}-${safeName}`;

    const { error } = await supabase.storage.from("dish-photos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      setUploadError("Upload failed — please try again.");
      setUploading(false);
      return;
    }

    const { data: pub } = supabase.storage.from("dish-photos").getPublicUrl(path);
    setForm((f) => ({ ...f, photo_url: pub.publicUrl }));
    setUploading(false);
  }

  async function handleModelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || !restaurant) return;

    if (!file.name.toLowerCase().endsWith(".glb")) {
      setModelError("Please choose a .glb 3D model file.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setModelError("Model is too large — please use one under 20MB.");
      return;
    }

    setUploadingModel(true);
    setModelError("");
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "-");
    const path = `${restaurant.id}/${Date.now()}-${safeName}`;

    const { error } = await supabase.storage.from("dish-models").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      setModelError("Upload failed — please try again.");
      setUploadingModel(false);
      return;
    }

    const { data: pub } = supabase.storage.from("dish-models").getPublicUrl(path);
    setForm((f) => ({ ...f, ar_model_url: pub.publicUrl }));
    setUploadingModel(false);
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
      category_id: form.category_id || null,
      is_veg: form.is_veg,
      ar_enabled: form.ar_enabled,
      ar_model_url: form.ar_model_url || null,
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

        <div className="section-card" style={{ padding: 18, marginBottom: 18 }}>
          <p className="text-sm font-medium mb-2.5">Categories</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {categories.map((cat) => (
              <span
                key={cat.id}
                className="status-pill status-new"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {cat.name}
                <button onClick={() => deleteCategory(cat.id)} aria-label={`Delete ${cat.name}`}>
                  <X size={11} />
                </button>
              </span>
            ))}
            {categories.length === 0 && (
              <p className="text-xs text-inkSoft">No categories yet — add ones like "South Indian" or "Desserts" below.</p>
            )}
          </div>
          <form onSubmit={addCategory} className="flex gap-2">
            <input
              placeholder="New category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="flex-1 border border-ink/15 rounded-md px-3 py-2 text-sm bg-cream focus:outline-none focus:border-gold transition-colors"
            />
            <button type="submit" disabled={savingCategory || !newCategoryName.trim()} className="btn-gold px-4 text-xs">
              Add
            </button>
          </form>
        </div>

        {[...categories, { id: "__uncategorized", name: "Uncategorized", sort_order: 999 }]
          .map((cat) => ({ cat, items: dishes.filter((d) => (d.category_id ?? "__uncategorized") === cat.id) }))
          .filter((g) => g.items.length > 0)
          .map((group) => (
            <div key={group.cat.id} className="mb-5">
              <p className="text-xs uppercase tracking-wide text-inkSoft mb-2" style={{ letterSpacing: 1 }}>
                {group.cat.name}
              </p>
              <div className="space-y-2.5">
                {group.items.map((dish, i) => (
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
                      <p className="text-sm font-medium truncate flex items-center gap-1.5">
                        <span
                          style={{
                            width: 11, height: 11, flexShrink: 0,
                            border: `1.5px solid ${dish.is_veg ? "#1c7a44" : "#b23b3b"}`,
                            borderRadius: 2, display: "inline-flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          {dish.is_veg ? (
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#1c7a44" }} />
                          ) : (
                            <span style={{ width: 0, height: 0, borderLeft: "3px solid transparent", borderRight: "3px solid transparent", borderBottom: "5px solid #b23b3b" }} />
                          )}
                        </span>
                        {dish.name}
                      </p>
                      <p className="text-xs text-goldDeep mt-0.5 font-medium">₹{dish.price}</p>
                    </div>
                    <button
                      onClick={() => toggleAvailable(dish)}
                      className={`status-pill ${dish.is_available ? "status-new" : "status-cancelled"}`}
                    >
                      {dish.is_available ? "Available" : "Hidden"}
                    </button>
                    {dish.ar_enabled && dish.ar_model_url && (
                      <span className="status-pill" style={{ background: "rgba(184,135,63,0.15)", color: "#8C6428" }}>
                        <Box size={11} style={{ display: "inline", verticalAlign: -1, marginRight: 3 }} /> AR
                      </span>
                    )}
                    <button onClick={() => openEdit(dish)} className="p-2 text-inkSoft hover:text-ink transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(dish.id)} className="p-2 text-inkSoft hover:text-red-600 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        {dishes.length === 0 && (
          <div className="section-card text-center py-12">
            <p className="text-sm text-inkSoft">No dishes yet — add your first one.</p>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-6 z-50 backdrop-blur-sm">
            <form onSubmit={handleSave} className="section-card w-full max-w-md space-y-3">
              <h2 style={{ marginBottom: 4, fontSize: 20, fontFamily: "'Playfair Display', serif", fontWeight: 600, color: "#1E1B16", letterSpacing: 0, textTransform: "none" }}>
                {editing ? "Edit dish" : "Add dish"}
              </h2>

              <div className="flex items-center gap-3">
                {form.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.photo_url} alt="" className="w-16 h-16 rounded-md object-cover shrink-0 border border-ink/10" />
                ) : (
                  <div className="w-16 h-16 rounded-md bg-creamDeep flex items-center justify-center text-inkSoft shrink-0">
                    <UtensilsCrossed size={20} strokeWidth={1.5} />
                  </div>
                )}
                <label className="flex-1 flex items-center justify-center gap-2 border border-ink/15 rounded-md px-3 py-2.5 text-sm cursor-pointer hover:bg-creamDeep transition-colors">
                  {uploading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={15} /> {form.photo_url ? "Replace photo" : "Upload photo"}
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} className="hidden" />
                </label>
              </div>
              {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

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
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="w-full border border-ink/15 rounded-md px-3 py-2.5 text-sm bg-cream focus:outline-none focus:border-gold transition-colors"
              >
                <option value="">No category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_veg: true })}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm border transition-colors ${form.is_veg ? "border-green-600 bg-green-50 text-green-800" : "border-ink/15 bg-cream text-inkSoft"}`}
                >
                  <span style={{ width: 12, height: 12, border: "1.5px solid #1c7a44", borderRadius: 2, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1c7a44" }} />
                  </span>
                  Veg
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_veg: false })}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm border transition-colors ${!form.is_veg ? "border-red-600 bg-red-50 text-red-800" : "border-ink/15 bg-cream text-inkSoft"}`}
                >
                  <span style={{ width: 12, height: 12, border: "1.5px solid #b23b3b", borderRadius: 2, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderBottom: "7px solid #b23b3b" }} />
                  </span>
                  Non-veg
                </button>
              </div>
              <input
                placeholder="Or paste an image URL instead"
                value={form.photo_url}
                onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                className="w-full border border-ink/15 rounded-md px-3 py-2.5 text-sm bg-cream focus:outline-none focus:border-gold transition-colors"
              />

              <div className="border-t border-ink/10 pt-3 mt-1">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, ar_enabled: !form.ar_enabled })}
                  className={`w-full flex items-center justify-between rounded-md px-3 py-2.5 text-sm border transition-colors ${form.ar_enabled ? "border-goldDeep bg-creamDeep" : "border-ink/15 bg-cream text-inkSoft"}`}
                >
                  <span className="flex items-center gap-2">
                    <Box size={15} /> Enable AR — "View on Table"
                  </span>
                  <span
                    style={{
                      width: 34, height: 19, borderRadius: 999, background: form.ar_enabled ? "#B8873F" : "rgba(30,27,22,0.15)",
                      position: "relative", transition: "background 0.2s ease", flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        position: "absolute", top: 2, left: form.ar_enabled ? 17 : 2, width: 15, height: 15, borderRadius: "50%",
                        background: "#fff", transition: "left 0.2s ease",
                      }}
                    />
                  </span>
                </button>

                {form.ar_enabled && (
                  <div className="mt-3 space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-md bg-creamDeep flex items-center justify-center text-goldDeep shrink-0 border border-ink/10">
                        <Box size={20} strokeWidth={1.5} />
                      </div>
                      <label className="flex-1 flex items-center justify-center gap-2 border border-ink/15 rounded-md px-3 py-2.5 text-sm cursor-pointer hover:bg-creamDeep transition-colors">
                        {uploadingModel ? (
                          <>
                            <Loader2 size={15} className="animate-spin" /> Uploading...
                          </>
                        ) : (
                          <>
                            <Upload size={15} /> {form.ar_model_url ? "Replace 3D model" : "Upload 3D model (.glb)"}
                          </>
                        )}
                        <input type="file" accept=".glb" onChange={handleModelUpload} disabled={uploadingModel} className="hidden" />
                      </label>
                    </div>
                    {modelError && <p className="text-xs text-red-600">{modelError}</p>}
                    <input
                      placeholder="Or paste a .glb model URL instead"
                      value={form.ar_model_url}
                      onChange={(e) => setForm({ ...form, ar_model_url: e.target.value })}
                      className="w-full border border-ink/15 rounded-md px-3 py-2.5 text-sm bg-cream focus:outline-none focus:border-gold transition-colors"
                    />
                    <p className="text-xs text-inkSoft">
                      The "View on Table" button only appears on the customer menu once a dish has both AR enabled and a model attached.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={uploading} className="btn-gold flex-1 py-2.5">Save</button>
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
