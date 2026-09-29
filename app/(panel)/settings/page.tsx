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
  const [upiEnabled, setUpiEnabled] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load(rid: string) {
      const { data, error: err } = await supabase.from("restaurants").select("upi_id, upi_enabled").eq("id", rid).single();
      if (err || !data) {
        setError("Couldn't load payment settings. Make sure the upi_toggle.sql migration has been run.");
        return; // leave the form disabled so nothing gets overwritten
      }
      setUpiId(data.upi_id ?? "");
      setUpiEnabled(!!data.upi_enabled);
      setLoaded(true);
    }
    if (restaurant) load(restaurant.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurant) return;
    setSaving(true);
    setError("");
    const id = upiId.trim() || null;
    // No UPI ID = nothing to pay to, so the switch goes off with it.
    const { error: err } = await supabase
      .from("restaurants")
      .update(id ? { upi_id: id } : { upi_id: null, upi_enabled: false })
      .eq("id", restaurant.id);
    setSaving(false);
    if (err) { setError("Couldn't save. Please try again."); return; }
    if (!id) setUpiEnabled(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function toggleUpi() {
    if (!restaurant || toggling) return;
    const next = !upiEnabled;
    if (next && !upiId.trim()) { setError("Add and save a UPI ID first."); return; }
    setToggling(true);
    setError("");
    // Turning ON also saves the UPI ID currently in the box, so what customers see matches what's shown here.
    const { error: err } = await supabase
      .from("restaurants")
      .update(next ? { upi_enabled: true, upi_id: upiId.trim() } : { upi_enabled: false })
      .eq("id", restaurant.id);
    setToggling(false);
    if (err) { setError("Couldn't update the setting. Please try again."); return; }
    setUpiEnabled(next);
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
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-ink/10">
          <div className="pr-4">
            <p className="text-sm font-medium">Accept UPI payments</p>
            <p className="text-xs text-inkSoft mt-0.5">
              {upiEnabled ? "Customers see a Pay via UPI button on their orders." : "Off — no payment button is shown to customers."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={upiEnabled}
            aria-label="Accept UPI payments"
            onClick={toggleUpi}
            disabled={!loaded || toggling}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${upiEnabled ? "bg-gold" : "bg-ink/20"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${upiEnabled ? "translate-x-5" : ""}`}
            />
          </button>
        </div>
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
        {error && <p className="text-xs text-red-600 mt-2.5">{error}</p>}
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
