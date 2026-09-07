"use client";
import { useActiveRestaurant } from "@/lib/useActiveRestaurant";
import Sidebar from "@/components/Sidebar";

export default function PanelGate({ children }: { children: React.ReactNode }) {
  const { restaurant, isAdmin, loading } = useActiveRestaurant();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-inkSoft">
        Loading...
      </div>
    );
  }

  // Admins always get full access (e.g. to review/set up a client's
  // menu before approving them). Only a restaurant's own owner sees
  // the pending screen.
  if (restaurant && restaurant.status === "pending" && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
        <div className="auth-glow" aria-hidden="true" />
        <div className="section-card fade-up w-full max-w-sm relative z-10 text-center" style={{ padding: 34 }}>
          <div className="relative" style={{ paddingLeft: 22, display: "inline-block" }}>
            <div className="corner-sm" style={{ position: "absolute", top: 0, left: 0 }} aria-hidden="true" />
            <p className="panel-eyebrow" style={{ paddingLeft: 0 }}>
              ZYON <span style={{ color: "#8C6428" }}>HOLOMENU</span>
            </p>
          </div>
          <h1 className="panel-title" style={{ fontSize: 22, marginTop: 14 }}>Almost there</h1>
          <p className="text-sm text-inkSoft mt-3">
            Your restaurant &quot;{restaurant.name}&quot; is set up and waiting on approval from our
            team — this happens shortly after your plan is confirmed. We&apos;ll notify you the moment
            it&apos;s live.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-shell">
      <Sidebar />
      <main className="panel-main">{children}</main>
    </div>
  );
}
