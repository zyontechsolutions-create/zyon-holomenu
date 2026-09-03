"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
  }

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
        <h1 className="panel-title" style={{ fontSize: 26, marginTop: 14 }}>Control Panel</h1>
        <p className="text-sm text-inkSoft mt-2">Sign in to manage your menu.</p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-ink/15 rounded-md px-3.5 py-3 text-sm bg-cream focus:outline-none focus:border-gold transition-colors"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-ink/15 rounded-md px-3.5 py-3 text-sm bg-cream focus:outline-none focus:border-gold transition-colors"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-gold w-full py-3 mt-2">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
