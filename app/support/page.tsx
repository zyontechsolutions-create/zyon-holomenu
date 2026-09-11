"use client";
import { useState } from "react";

export default function SupportPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
        <div className="auth-glow" aria-hidden="true" />
        <div className="section-card fade-up w-full max-w-sm relative z-10 text-center" style={{ padding: 34 }}>
          <h1 className="panel-title" style={{ fontSize: 22 }}>Ticket received</h1>
          <p className="text-sm text-inkSoft mt-3">
            Thanks, {name} — we&apos;ve got your message and will get back to you at <strong>{email}</strong> soon.
          </p>
          <a href="/" className="text-sm text-goldDeep mt-5 inline-block">← Back home</a>
        </div>
      </div>
    );
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
        <h1 className="panel-title" style={{ fontSize: 26, marginTop: 14 }}>Raise a ticket</h1>
        <p className="text-sm text-inkSoft mt-2">
          Questions, issues, or anything else — tell us and we&apos;ll get back to you.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-3">
          <input
            required
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-ink/15 rounded-md px-3.5 py-3 text-sm bg-cream focus:outline-none focus:border-gold transition-colors"
          />
          <input
            type="email"
            required
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-ink/15 rounded-md px-3.5 py-3 text-sm bg-cream focus:outline-none focus:border-gold transition-colors"
          />
          <textarea
            required
            rows={5}
            placeholder="What's going on?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full border border-ink/15 rounded-md px-3.5 py-3 text-sm bg-cream focus:outline-none focus:border-gold transition-colors resize-none"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-gold w-full py-3 mt-2">
            {loading ? "Sending..." : "Submit ticket"}
          </button>
        </form>
      </div>
    </div>
  );
}
