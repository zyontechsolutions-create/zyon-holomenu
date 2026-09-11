"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();
  const [restaurantName, setRestaurantName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  function slugify(value: string) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function handleNameChange(value: string) {
    setRestaurantName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const cleanSlug = slugify(slug);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          pending_restaurant_name: restaurantName,
          pending_restaurant_slug: cleanSlug,
        },
      },
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      // Email confirmation is off in this Supabase project — already logged in.
      const { error: insertError } = await supabase.from("restaurants").insert({
        name: restaurantName,
        slug: cleanSlug,
        owner_id: data.user!.id,
      });
      setLoading(false);
      if (insertError) {
        setError(
          insertError.message.toLowerCase().includes("duplicate")
            ? "That URL is already taken — try a different one."
            : insertError.message
        );
        return;
      }
      router.push("/dashboard");
      return;
    }

    // Email confirmation is required. The restaurant gets created
    // automatically the first time they log in (see RestaurantContext).
    setLoading(false);
    setCheckEmail(true);
  }

  if (checkEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
        <div className="auth-glow" aria-hidden="true" />
        <div className="section-card fade-up w-full max-w-sm relative z-10 text-center" style={{ padding: 34 }}>
          <h1 className="panel-title" style={{ fontSize: 22 }}>Check your email</h1>
          <p className="text-sm text-inkSoft mt-3">
            We&apos;ve sent a confirmation link to <strong>{email}</strong>. Confirm it, then sign in —
            your restaurant &quot;{restaurantName}&quot; will be set up automatically.
          </p>
          <a href="/login" className="text-sm text-goldDeep mt-5 inline-block">← Back to sign in</a>
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
        <h1 className="panel-title" style={{ fontSize: 26, marginTop: 14 }}>Create your menu</h1>
        <p className="text-sm text-inkSoft mt-2">Set up your restaurant in a couple of minutes.</p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-3">
          <input
            required
            placeholder="Restaurant name"
            value={restaurantName}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full border border-ink/15 rounded-md px-3.5 py-3 text-sm bg-cream focus:outline-none focus:border-gold transition-colors"
          />
          <div>
            <div className="flex items-center border border-ink/15 rounded-md bg-cream focus-within:border-gold transition-colors overflow-hidden">
              <span className="pl-3.5 text-sm text-inkSoft whitespace-nowrap">/m/</span>
              <input
                required
                placeholder="url-slug"
                value={slug}
                onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
                className="w-full py-3 pr-3.5 text-sm bg-cream focus:outline-none"
              />
            </div>
            <p className="text-xs text-inkSoft mt-1.5">
              Your menu&apos;s public link — letters, numbers, and hyphens only.
            </p>
          </div>
          <input
            type="email"
            required
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-ink/15 rounded-md px-3.5 py-3 text-sm bg-cream focus:outline-none focus:border-gold transition-colors"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-ink/15 rounded-md px-3.5 py-3 text-sm bg-cream focus:outline-none focus:border-gold transition-colors"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-gold w-full py-3 mt-2">
            {loading ? "Setting up..." : "Create my menu"}
          </button>
        </form>
        <p style={{ fontSize: 11.5, color: "#6b6455", textAlign: "center", marginTop: 14 }}>
          By creating an account you agree to our{" "}
          <a href="/terms" style={{ color: "#8C6428" }}>Terms of Service</a> and{" "}
          <a href="/privacy" style={{ color: "#8C6428" }}>Privacy Policy</a>.
        </p>

        <p className="text-xs text-inkSoft mt-5 text-center">
          Already have an account? <a href="/login" className="text-goldDeep">Sign in</a>
        </p>
      </div>
    </div>
  );
}
