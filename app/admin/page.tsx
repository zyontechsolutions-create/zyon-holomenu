"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";
import Sidebar from "@/components/Sidebar";
import { Plus, ArrowRight, Building2 } from "lucide-react";

type Restaurant = { id: string; name: string; slug: string; plan: string; created_at: string; dish_count?: number };

export default function AdminPage() {
  const supabase = createClient();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", owner_id: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: adminRow } = await supabase
      .from("zyon_admins").select("user_id").eq("user_id", userData.user.id).maybeSingle();
    if (!adminRow) { setIsAdmin(false); return; }
    setIsAdmin(true);

    const { data: restaurantList } = await supabase
      .from("restaurants").select("id, name, slug, plan, created_at").order("created_at", { ascending: false });

    const withCounts = await Promise.all(
      (restaurantList ?? []).map(async (r) => {
        const { count } = await supabase.from("dishes").select("*", { count: "exact", head: true }).eq("restaurant_id", r.id);
        return { ...r, dish_count: count ?? 0 };
      })
    );
    setRestaurants(withCounts);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const { error } = await supabase.from("restaurants").insert({
      name: form.name,
      slug: form.slug.trim().toLowerCase().replace(/\s+/g, "-"),
      owner_id: form.owner_id,
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    setForm({ name: "", slug: "", owner_id: "" });
    setShowForm(false);
    load();
  }

  if (isAdmin === null) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-inkSoft">Loading...</div>;
  }
  if (isAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6">
        <div>
          <p className="font-display text-xl font-semibold">Admin access only</p>
          <p className="text-sm text-inkSoft mt-2">This login isn&apos;t set up as a Zyon admin.</p>
          <Link href="/dashboard" className="text-sm text-goldDeep mt-4 inline-block">← Back to your dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-shell">
      <Sidebar />
      <main className="panel-main">
        <div className="panel-header">
          <div>
            <p className="panel-eyebrow">Zyon Tech Solutions</p>
            <h1 className="panel-title">Restaurant Clients</h1>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-gold flex items-center gap-2">
            <Plus size={15} /> Add restaurant
          </button>
        </div>

        <div className="space-y-2.5">
          {restaurants.map((r, i) => (
            <div key={r.id} className="list-row fade-up" style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s` }}>
              <div className="w-10 h-10 rounded-md bg-creamDeep flex items-center justify-center text-goldDeep shrink-0">
                <Building2 size={16} strokeWidth={1.6} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{r.name}</p>
                <p className="text-xs text-inkSoft mt-0.5">
                  /m/{r.slug} · {r.dish_count} dish{r.dish_count !== 1 ? "es" : ""} · {r.plan}
                </p>
              </div>
              <Link href={`/dashboard?restaurant=${r.id}`} className="btn-gold flex items-center gap-2 text-xs">
                Manage <ArrowRight size={13} />
              </Link>
            </div>
          ))}
          {restaurants.length === 0 && (
            <div className="section-card text-center py-12">
              <p className="text-sm text-inkSoft">No restaurant clients yet — add your first one.</p>
            </div>
          )}
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-6 z-50 backdrop-blur-sm">
            <form onSubmit={handleAdd} className="section-card w-full max-w-md space-y-3">
              <h2 style={{ fontSize: 20, fontFamily: "'Playfair Display', serif", fontWeight: 600, color: "#1E1B16", textTransform: "none", letterSpacing: 0 }}>
                Add a restaurant
              </h2>
              <p className="text-xs text-inkSoft" style={{ marginBottom: 4 }}>
                The owner needs a login already created in Supabase → Authentication → Users.
                Paste their User ID (UID) below.
              </p>
              <input
                required placeholder="Restaurant name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-ink/15 rounded-md px-3 py-2.5 text-sm bg-cream focus:outline-none focus:border-gold"
              />
              <input
                required placeholder="URL slug (e.g. emberoak)" value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="w-full border border-ink/15 rounded-md px-3 py-2.5 text-sm bg-cream focus:outline-none focus:border-gold"
              />
              <input
                required placeholder="Owner's Supabase User ID (UUID)" value={form.owner_id}
                onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
                className="w-full border border-ink/15 rounded-md px-3 py-2.5 text-sm bg-cream focus:outline-none focus:border-gold"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn-gold flex-1 py-2.5">
                  {saving ? "Adding..." : "Add restaurant"}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 text-sm text-inkSoft border border-ink/15 rounded-full hover:bg-creamDeep">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
