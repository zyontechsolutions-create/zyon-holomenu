"use client";
import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useActiveRestaurant } from "@/lib/useActiveRestaurant";
import { Bell, Check } from "lucide-react";

type WaiterCall = {
  id: string;
  status: string;
  created_at: string;
  qr_codes: { label: string } | null;
};

function WaiterCallsPage() {
  const supabase = createClient();
  const { restaurant, clearWaiterCalls } = useActiveRestaurant();
  const [calls, setCalls] = useState<WaiterCall[]>([]);

  async function loadCalls(rid: string) {
    const { data } = await supabase
      .from("waiter_calls")
      .select("id, status, created_at, qr_codes(label)")
      .eq("restaurant_id", rid)
      .order("created_at", { ascending: false })
      .limit(50);
    setCalls((data as any) ?? []);
  }

  // Staff has now seen this page — clear the sidebar badge.
  useEffect(() => {
    clearWaiterCalls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  useEffect(() => {
    if (!restaurant) return;
    loadCalls(restaurant.id);
    const channel = supabase
      .channel("waiter-calls-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waiter_calls", filter: `restaurant_id=eq.${restaurant.id}` },
        () => loadCalls(restaurant.id)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  async function resolveCall(id: string) {
    await supabase.from("waiter_calls").update({ status: "resolved" }).eq("id", id);
    if (restaurant) loadCalls(restaurant.id);
  }

  const pending = calls.filter((c) => c.status === "pending");
  const resolved = calls.filter((c) => c.status === "resolved");

  return (
    <>
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">{restaurant?.name ?? "Live"}</p>
          <h1 className="panel-title">Waiter Calls</h1>
        </div>
      </div>

      <div className="space-y-2.5">
        {pending.map((call, i) => (
          <div
            key={call.id}
            className="list-row fade-up"
            style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s`, borderColor: "rgba(184,135,63,0.4)" }}
          >
            <div className="w-10 h-10 rounded-md bg-creamDeep flex items-center justify-center text-goldDeep shrink-0">
              <Bell size={16} strokeWidth={1.6} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{call.qr_codes?.label ?? "Table"}</p>
              <p className="text-xs text-inkSoft mt-0.5">{new Date(call.created_at).toLocaleString()}</p>
            </div>
            <span className="status-pill status-new">Pending</span>
            <button
              onClick={() => resolveCall(call.id)}
              className="p-2 text-inkSoft hover:text-green-700 transition-colors"
              aria-label="Mark resolved"
            >
              <Check size={17} />
            </button>
          </div>
        ))}

        {pending.length === 0 && (
          <div className="section-card text-center py-12">
            <p className="text-sm text-inkSoft">No pending calls right now.</p>
          </div>
        )}

        {resolved.length > 0 && (
          <>
            <p className="text-xs uppercase tracking-wide text-inkSoft mt-6 mb-2" style={{ letterSpacing: 1 }}>
              Resolved
            </p>
            {resolved.slice(0, 15).map((call) => (
              <div key={call.id} className="list-row" style={{ opacity: 0.6 }}>
                <div className="w-10 h-10 rounded-md bg-creamDeep flex items-center justify-center text-inkSoft shrink-0">
                  <Bell size={16} strokeWidth={1.6} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{call.qr_codes?.label ?? "Table"}</p>
                  <p className="text-xs text-inkSoft mt-0.5">{new Date(call.created_at).toLocaleString()}</p>
                </div>
                <span className="status-pill status-served">Resolved</span>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}

export default function WaiterCallsPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-inkSoft">Loading...</div>}>
      <WaiterCallsPage />
    </Suspense>
  );
}
