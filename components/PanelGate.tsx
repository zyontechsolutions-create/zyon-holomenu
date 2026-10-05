"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useActiveRestaurant } from "@/lib/useActiveRestaurant";
import { buildTicketHtml, getAutoPrint, isPrinted, markPrinted, printHtml, TicketOrder } from "@/lib/autoPrint";

const POLL_MS = 15000;
const CATCHUP_MS = 30 * 60 * 1000; // never print orders older than this

// Invisible. Runs in the background of the whole panel and prints a kitchen
// ticket for every new order, if this device has Auto-print switched on.
export default function AutoPrintStation() {
  const supabase = createClient();
  const { restaurant } = useActiveRestaurant();

  useEffect(() => {
    if (!restaurant) return;
    const rid = restaurant.id;
    const name = restaurant.name;
    const mountedAt = Date.now() - 5000;
    const handled = new Set<string>();
    let stopped = false;
    let busy = false;

    async function check() {
      if (stopped || busy) return;
      const s = getAutoPrint(rid);
      if (!s.enabled) return;
      busy = true;
      try {
        const from = new Date(Math.max(mountedAt, s.enabledAt, Date.now() - CATCHUP_MS)).toISOString();
        const { data } = await supabase
          .from("orders")
          .select("id, status, created_at, qr_codes(label), order_items(quantity, note, dishes(name))")
          .eq("restaurant_id", rid)
          .gte("created_at", from)
          .order("created_at", { ascending: true })
          .limit(50);

        for (const o of ((data as any[]) ?? [])) {
          if (stopped) break;
          if (handled.has(o.id) || isPrinted(rid, o.id)) continue;
          if (o.status === "cancelled") { handled.add(o.id); continue; }
          const items = o.order_items ?? [];
          if (items.length === 0) {
            // Items are saved a moment after the order. Wait for the next check,
            // but give up on orders that never get items.
            if (Date.now() - new Date(o.created_at).getTime() > 2 * 60 * 1000) handled.add(o.id);
            continue;
          }
          handled.add(o.id);
          markPrinted(rid, o.id); // mark first so a crash can never cause a reprint loop
          await printHtml(buildTicketHtml(name, o as TicketOrder, getAutoPrint(rid).width));
        }
      } finally {
        busy = false;
      }
    }

    // Instant: react to a new order, then re-check shortly (its items arrive a moment later).
    const channel = supabase
      .channel(`auto-print-${rid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `restaurant_id=eq.${rid}` },
        () => {
          setTimeout(check, 2000);
          setTimeout(check, 5000);
        }
      )
      .subscribe();

    // Safety net: catches anything missed (dropped connection, sleeping tab).
    const timer = setInterval(check, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  return null;
}
