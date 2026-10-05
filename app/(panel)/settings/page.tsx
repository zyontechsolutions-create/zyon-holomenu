"use client";
import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useActiveRestaurant } from "@/lib/useActiveRestaurant";
import { Check } from "lucide-react";
import { GST_RATES, GSTIN_RE } from "@/lib/billing";

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

  // ---- Billing details ----
  const emptyBilling = { legal_name: "", address: "", phone: "", gstin: "", gst_rate: 5, prices_include_gst: true, bill_prefix: "INV", bill_footer: "" };
  const [billing, setBilling] = useState(emptyBilling);
  const [billingLoaded, setBillingLoaded] = useState(false);
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingSaved, setBillingSaved] = useState(false);
  const [billingError, setBillingError] = useState("");

  useEffect(() => {
    async function loadBilling(rid: string) {
      const { data, error: err } = await supabase
        .from("restaurants")
        .select("legal_name, address, phone, gstin, gst_rate, prices_include_gst, bill_prefix, bill_footer")
        .eq("id", rid)
        .single();
      if (err || !data) {
        setBillingError("Couldn't load billing details. Make sure supabase/billing.sql has been run.");
        return;
      }
      setBilling({
        legal_name: data.legal_name ?? "",
        address: data.address ?? "",
        phone: data.phone ?? "",
        gstin: data.gstin ?? "",
        gst_rate: Number(data.gst_rate ?? 5),
        prices_include_gst: data.prices_include_gst ?? true,
        bill_prefix: data.bill_prefix ?? "INV",
        bill_footer: data.bill_footer ?? "",
      });
      setBillingLoaded(true);
    }
    if (restaurant) loadBilling(restaurant.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  async function saveBilling(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurant) return;
    setBillingError("");
    const gstin = billing.gstin.trim().toUpperCase();
    if (gstin && !GSTIN_RE.test(gstin)) { setBillingError("That GSTIN doesn't look right. It should be 15 characters, e.g. 29ABCDE1234F1Z5."); return; }
    const prefix = billing.bill_prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "INV";
    setBillingSaving(true);
    const { data: rows, error: err } = await supabase
      .from("restaurants")
      .update({
        legal_name: billing.legal_name.trim() || null,
        address: billing.address.trim() || null,
        phone: billing.phone.trim() || null,
        gstin: gstin || null,
        gst_rate: billing.gst_rate,
        prices_include_gst: billing.prices_include_gst,
        bill_prefix: prefix,
        bill_footer: billing.bill_footer.trim() || null,
      })
      .eq("id", restaurant.id)
      .select("id");
    setBillingSaving(false);
    if (err) {
      setBillingError(/restaurants_gstin_chk/.test(err.message) ? "That GSTIN isn't valid." : "Couldn't save. Please try again.");
      return;
    }
    if (!rows || rows.length === 0) { setBillingError("Couldn't save (no permission for this restaurant)."); return; }
    setBilling((b) => ({ ...b, gstin, bill_prefix: prefix }));
    setBillingSaved(true);
    setTimeout(() => setBillingSaved(false), 2500);
  }

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

      <div className="section-card max-w-sm mt-5">
        <p className="text-sm font-medium mb-1">Billing details</p>
        <p className="text-xs text-inkSoft mb-3.5">
          Shown on the bills you print or share from the Orders page. Bills already generated keep their old details until you tap
          &ldquo;Refresh details&rdquo; on that bill.
        </p>
        <form onSubmit={saveBilling} className="space-y-3">
          {([
            ["legal_name", "Business name on bill", "Leave blank to use your restaurant name"],
            ["address", "Address", "Street, city, PIN"],
            ["phone", "Phone", "e.g. 98765 43210"],
            ["gstin", "GSTIN (optional)", "e.g. 29ABCDE1234F1Z5"],
          ] as const).map(([key, label, ph]) => (
            <label key={key} className="block">
              <span className="text-xs text-inkSoft">{label}</span>
              <input
                placeholder={ph}
                value={(billing as any)[key]}
                onChange={(e) => setBilling((b) => ({ ...b, [key]: e.target.value }))}
                disabled={!billingLoaded}
                className="mt-1 w-full border border-ink/15 rounded-md px-3.5 py-2.5 text-sm bg-cream focus:outline-none focus:border-gold transition-colors disabled:opacity-60"
              />
            </label>
          ))}

          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="text-xs text-inkSoft">GST rate</span>
              <select
                value={billing.gst_rate}
                onChange={(e) => setBilling((b) => ({ ...b, gst_rate: Number(e.target.value) }))}
                disabled={!billingLoaded}
                className="mt-1 w-full border border-ink/15 rounded-md px-3 py-2.5 text-sm bg-cream focus:outline-none focus:border-gold"
              >
                {GST_RATES.map((r) => <option key={r} value={r}>{r === 0 ? "No GST" : `${r}%`}</option>)}
              </select>
            </label>
            <label className="block flex-1">
              <span className="text-xs text-inkSoft">Bill number prefix</span>
              <input
                value={billing.bill_prefix}
                maxLength={8}
                onChange={(e) => setBilling((b) => ({ ...b, bill_prefix: e.target.value }))}
                disabled={!billingLoaded}
                className="mt-1 w-full border border-ink/15 rounded-md px-3.5 py-2.5 text-sm bg-cream focus:outline-none focus:border-gold uppercase"
              />
            </label>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="pr-4">
              <p className="text-sm">Menu prices include GST</p>
              <p className="text-xs text-inkSoft mt-0.5">
                {billing.prices_include_gst ? "GST is split out of the price. Bill total = menu total." : "GST is added on top of the menu total."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={billing.prices_include_gst}
              aria-label="Menu prices include GST"
              onClick={() => setBilling((b) => ({ ...b, prices_include_gst: !b.prices_include_gst }))}
              disabled={!billingLoaded}
              className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${billing.prices_include_gst ? "bg-gold" : "bg-ink/20"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${billing.prices_include_gst ? "translate-x-5" : ""}`} />
            </button>
          </div>

          <label className="block">
            <span className="text-xs text-inkSoft">Footer message (optional)</span>
            <input
              placeholder="e.g. Thank you! Follow us @emberandoak"
              value={billing.bill_footer}
              onChange={(e) => setBilling((b) => ({ ...b, bill_footer: e.target.value }))}
              disabled={!billingLoaded}
              className="mt-1 w-full border border-ink/15 rounded-md px-3.5 py-2.5 text-sm bg-cream focus:outline-none focus:border-gold disabled:opacity-60"
            />
          </label>

          <button type="submit" className="btn-gold px-4 w-full" disabled={billingSaving || !billingLoaded}>
            {billingSaving ? "Saving..." : "Save billing details"}
          </button>
        </form>
        {billingError && <p className="text-xs text-red-600 mt-2.5">{billingError}</p>}
        {billingSaved && (
          <p className="text-xs text-inkSoft mt-2.5 flex items-center gap-1.5"><Check size={13} /> Saved</p>
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
