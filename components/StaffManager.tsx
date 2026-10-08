"use client";
import { useCallback, useEffect, useState } from "react";
import { Copy, Check, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";

type StaffRow = {
  id: string;
  name: string;
  username: string;
  role: "kitchen" | "cashier";
  active: boolean;
  locked_until: string | null;
};
type Credentials = { name: string; username: string; pin: string; role: string; heading: string };

export default function StaffManager({ restaurantId, slug }: { restaurantId: string; slug: string }) {
  const supabase = createClient();
  const [list, setList] = useState<StaffRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"kitchen" | "cashier">("kitchen");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("staff")
      .select("id, name, username, role, active, locked_until")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: true });
    if (err) { setLoadError("Staff accounts aren't set up in the database yet. Run supabase/staff.sql in Supabase."); setLoaded(true); return; }
    setLoadError("");
    setList((data as StaffRow[]) ?? []);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  async function call(action: string, payload: Record<string, unknown>) {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error("Please sign in again.");
    const res = await fetch("/api/staff/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
    return data;
  }

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await call("create", { restaurant_id: restaurantId, name, username, role });
      setCreds({ name: data.staff.name, username: data.staff.username, pin: data.pin, role: data.staff.role, heading: "Account created" });
      setName(""); setUsername(""); setAdding(false);
      load();
    } catch (err: any) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function resetPin(s: StaffRow) {
    if (!window.confirm(`Reset the PIN for ${s.name}? Their old PIN will stop working.`)) return;
    setError("");
    try {
      const data = await call("reset_pin", { staff_id: s.id });
      setCreds({ name: s.name, username: s.username, pin: data.pin, role: s.role, heading: "New PIN" });
      load();
    } catch (err: any) { setError(err.message); }
  }

  async function toggleActive(s: StaffRow) {
    setError("");
    try { await call("set_active", { staff_id: s.id, active: !s.active }); load(); }
    catch (err: any) { setError(err.message); }
  }

  async function remove(s: StaffRow) {
    if (!window.confirm(`Remove ${s.name}? They will no longer be able to sign in.`)) return;
    setError("");
    try { await call("remove", { staff_id: s.id }); load(); }
    catch (err: any) { setError(err.message); }
  }

  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/staff-login?r=${slug}` : `/staff-login?r=${slug}`;

  async function copyCreds() {
    if (!creds) return;
    const text = `Restaurant code: ${slug}\nUsername: ${creds.username}\nPIN: ${creds.pin}\nSign in: ${loginUrl}`;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  }

  const input = "mt-1 w-full border border-ink/15 rounded-md px-3.5 py-2.5 text-sm bg-cream focus:outline-none focus:border-gold transition-colors";

  return (
    <div className="section-card max-w-sm mt-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium">Staff accounts</p>
        {!adding && !loadError && (
          <button onClick={() => { setAdding(true); setError(""); }} className="inline-flex items-center gap-1.5 text-xs border border-ink/15 rounded-md px-3 py-1.5 hover:bg-cream transition-colors">
            <UserPlus size={13} /> Add staff
          </button>
        )}
      </div>
      <p className="text-xs text-inkSoft mb-3.5">
        Give kitchen and cashier staff their own login. Kitchen sees only the Kitchen screen. Cashier sees only Orders (mark paid, bills).
      </p>

      {loadError && <p className="text-xs text-red-600">{loadError}</p>}

      {creds && (
        <div className="rounded-md p-3.5 mb-3.5" style={{ background: "#e1f0e5", border: "1px solid #b9dcc4" }}>
          <p className="text-sm font-medium" style={{ color: "#1c7a44" }}>{creds.heading}: {creds.name}</p>
          <p className="text-xs text-inkSoft mt-1">Save these now. The PIN is shown only once.</p>
          <div className="mt-2.5 text-sm space-y-1">
            <p>Restaurant code: <strong>{slug}</strong></p>
            <p>Username: <strong>{creds.username}</strong></p>
            <p>PIN: <strong style={{ letterSpacing: 3, fontSize: 17 }}>{creds.pin}</strong></p>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={copyCreds} className="inline-flex items-center gap-1.5 text-xs border border-ink/20 rounded-md px-3 py-1.5 bg-white">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy login details"}
            </button>
            <button onClick={() => setCreds(null)} className="text-xs underline text-inkSoft">Done</button>
          </div>
        </div>
      )}

      {adding && (
        <form onSubmit={addStaff} className="space-y-3 mb-4 pb-4 border-b border-ink/10">
          <label className="block">
            <span className="text-xs text-inkSoft">Name</span>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ravi" maxLength={60} required />
          </label>
          <label className="block">
            <span className="text-xs text-inkSoft">Username</span>
            <input
              className={input}
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
              placeholder="e.g. kitchen1"
              autoCapitalize="none"
              minLength={3}
              maxLength={20}
              required
            />
          </label>
          <label className="block">
            <span className="text-xs text-inkSoft">Role</span>
            <select className={input} value={role} onChange={(e) => setRole(e.target.value as "kitchen" | "cashier")}>
              <option value="kitchen">Kitchen: sees the Kitchen screen only</option>
              <option value="cashier">Cashier: Orders, payments and bills</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn-gold px-4 flex-1" disabled={busy}>{busy ? "Creating..." : "Create account"}</button>
            <button type="button" onClick={() => { setAdding(false); setError(""); }} className="border border-ink/15 rounded-md px-4 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {error && <p className="text-xs text-red-600 mb-3" role="alert">{error}</p>}

      {loaded && !loadError && list.length === 0 && !adding && (
        <p className="text-xs text-inkSoft">No staff yet. Tap Add staff to create the first login.</p>
      )}

      <div className="space-y-3">
        {list.map((s) => {
          const locked = !!s.locked_until && new Date(s.locked_until).getTime() > Date.now();
          return (
            <div key={s.id} className="border border-ink/10 rounded-md p-3" style={{ opacity: s.active ? 1 : 0.6 }}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs text-inkSoft">
                    {s.username} · <span className="capitalize">{s.role}</span>
                    {!s.active && " · Off"}
                    {locked && " · Locked"}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-2.5 text-xs">
                <button onClick={() => resetPin(s)} className="underline text-inkSoft">Reset PIN{locked ? " & unlock" : ""}</button>
                <button onClick={() => toggleActive(s)} className="underline text-inkSoft">{s.active ? "Turn off" : "Turn on"}</button>
                <button onClick={() => remove(s)} className="underline" style={{ color: "#b23b3b" }}>Remove</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
