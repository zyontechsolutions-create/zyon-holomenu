"use client";
import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useActiveRestaurant } from "@/lib/useActiveRestaurant";
import { Check } from "lucide-react";

function SettingsPage() {
  const supabase = createClient();
  const { restaurant } = useActiveRestaurant();
  const [upiId, setUpiId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load(rid: string) {
      const { data } = await supabase.from("restaurants").select("upi_id").eq("id", rid).single();
      setUpiId(data?.upi_id ?? "");
      setLoaded(true);
    }
    if (restaurant) load(restaurant.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurant) return;
    setSaving(true);
    await supabase.from("restaurants").update({ upi_id: upiId.trim() || null }).eq("id", restaurant.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <>
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">Payments</p>
          <h1 className="panel-title">Settings</h1>
        </div>
      </div>

      <div className="section-card max-w-sm">
        <p className="text-sm font-medium mb-1">UPI ID</p>
        <p className="text-xs text-inkSoft mb-3.5">
          Add your UPI ID so customers can pay you directly from the order confirmation screen —
          no gateway, no fees, opens their UPI app with the amount pre-filled.
        </p>
        <form onSubmit={save} className="flex gap-2">
          <input
            placeholder="e.g. yourrestaurant@okhdfcbank"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            className="flex-1 border border-ink/15 rounded-md px-3.5 py-2.5 text-sm bg-cream focus:outline-none focus:border-gold transition-colors"
          />
          <button type="submit" className="btn-gold px-4" disabled={saving || !loaded}>
            {saving ? "Saving..." : "Save"}
          </button>
        </form>
        {saved && (
          <p className="text-xs text-inkSoft mt-2.5 flex items-center gap-1.5">
            <Check size={13} /> Saved
          </p>
        )}
      </div>
    </>
  );
}

export default function SettingsPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-inkSoft">Loading...</div>}>
      <SettingsPage />
    </Suspense>
  );
}
