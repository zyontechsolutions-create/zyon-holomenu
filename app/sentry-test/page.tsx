"use client";

export default function SentryTestPage() {
  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Sentry test page</h1>
      <p>Tap the button below — it throws an error on purpose. It should show up in your Sentry dashboard within a minute or two.</p>
      <button
        onClick={() => {
          throw new Error("Sentry test error — safe to ignore, delete this page once confirmed.");
        }}
        style={{ padding: "10px 18px", marginTop: 16, cursor: "pointer" }}
      >
        Trigger test error
      </button>
    </div>
  );
}
