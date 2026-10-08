"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

export default function StaffLoginPage() {
  const supabase = createClient();
  const [restaurant, setRestaurant] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("r");
    if (r) setRestaurant(r);
    if (params.get("disabled")) setError("This account has been turned off. Please ask the owner.");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant, username, pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.access_token) {
        setError(data.error ?? "Couldn't sign in. Please try again.");
        setLoading(false);
        return;
      }
      const { error: sessErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessErr) { setError("Couldn't start your session. Please try again."); setLoading(false); return; }
      window.location.assign(data.role === "kitchen" ? "/kitchen" : "/orders");
    } catch {
      setError("Network problem. Please try again.");
      setLoading(false);
    }
  }

  const input = "w-full border border-ink/15 rounded-md px-3.5 py-3 text-sm bg-cream focus:outline-none focus:border-gold transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      <div className="auth-glow" aria-hidden="true" />
      <div className="section-card fade-up w-full max-w-sm relative z-10" style={{ padding: 34 }}>
        <div className="relative" style={{ paddingLeft: 22 }}>
          <div className="corner-sm" style={{ position: "absolute", top: 0, left: 0 }} aria-hidden="true" />
          <p className="panel-eyebrow" style={{ paddingLeft: 0 }}>
            ZYON <span style={{ color: "#8C6428" }}>HOLOMENU</span>
          </p>
        </div>
        <h1 className="panel-title" style={{ fontSize: 26, marginTop: 14 }}>Staff sign in</h1>
        <p className="text-sm text-inkSoft mt-2">Use the details your manager gave you.</p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-3">
          <input
            required
            placeholder="Restaurant code"
            value={restaurant}
            onChange={(e) => setRestaurant(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            className={input}
          />
          <input
            required
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            className={input}
          />
          <input
            required
            type="password"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="6-digit PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            autoComplete="current-password"
            className={input}
          />
          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
          <button type="submit" disabled={loading} className="btn-gold w-full py-3 mt-2">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="text-xs text-inkSoft mt-5 text-center">
          Restaurant owner? <a href="/login" className="text-goldDeep">Sign in here</a>
        </p>
      </div>
    </div>
  );
}
