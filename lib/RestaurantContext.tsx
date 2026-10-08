"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { playOrderChime, playWaiterChime } from "@/lib/notificationSound";

export type ActiveRestaurant = { id: string; name: string; slug: string; status: string } | null;
export type Role = "admin" | "owner" | "kitchen" | "cashier" | null;
type StaffRow = { restaurant_id: string; role: "kitchen" | "cashier"; active: boolean; name: string };

type RestaurantContextValue = {
  restaurant: ActiveRestaurant;
  isAdmin: boolean;
  role: Role;
  staffName: string | null;
  accessDisabled: boolean;
  loading: boolean;
  newOrderCount: number;
  clearNewOrders: () => void;
  waiterCallCount: number;
  clearWaiterCalls: () => void;
};

const RestaurantContext = createContext<RestaurantContextValue>({
  restaurant: null,
  isAdmin: false,
  role: null,
  staffName: null,
  accessDisabled: false,
  loading: true,
  newOrderCount: 0,
  clearNewOrders: () => {},
  waiterCallCount: 0,
  clearWaiterCalls: () => {},
});

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const overrideId = searchParams.get("restaurant");

  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [staff, setStaff] = useState<StaffRow | null>(null);
  const [restaurant, setRestaurant] = useState<ActiveRestaurant>(null);
  const [loading, setLoading] = useState(true);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [waiterCallCount, setWaiterCallCount] = useState(0);

  // Runs ONCE per session — not on every page switch.
  useEffect(() => {
    async function loadUser() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setLoading(false); return; }

      // Is this person a Zyon admin, or a staff member (kitchen / cashier)?
      const [{ data: adminRow }, { data: staffRow }] = await Promise.all([
        supabase.from("zyon_admins").select("user_id").eq("user_id", userData.user.id).maybeSingle(),
        supabase.from("staff").select("restaurant_id, role, active, name").eq("user_id", userData.user.id).maybeSingle(),
      ]);
      setIsAdmin(!!adminRow);
      setStaff((staffRow as StaffRow | null) ?? null);
      setUserId(userData.user.id);
    }
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Runs again only if the logged-in user changes, admin status resolves,
  // or an admin switches ?restaurant= — NOT on every tab click.
  useEffect(() => {
    if (!userId) return;
    async function loadRestaurant() {
      setLoading(true);
      if (staff) {
        // Staff are tied to one restaurant and never see or create anything else.
        if (!staff.active) { setRestaurant(null); setLoading(false); return; }
        const { data: r } = await supabase
          .from("restaurants")
          .select("id, name, slug, status")
          .eq("id", staff.restaurant_id)
          .single();
        setRestaurant(r ?? null);
        setLoading(false);
        return;
      }
      if (overrideId && isAdmin) {
        const { data: r } = await supabase
          .from("restaurants")
          .select("id, name, slug, status")
          .eq("id", overrideId)
          .single();
        setRestaurant(r ?? null);
      } else {
        const { data: r } = await supabase
          .from("restaurants")
          .select("id, name, slug, status")
          .eq("owner_id", userId)
          .maybeSingle();

        if (r) {
          setRestaurant(r);
        } else {
          // First login after an email-confirmation signup — the restaurant
          // row wasn't created yet. Finish it now from the pending signup data.
          const { data: userData } = await supabase.auth.getUser();
          const pendingName = userData.user?.user_metadata?.pending_restaurant_name;
          const pendingSlug = userData.user?.user_metadata?.pending_restaurant_slug;
          if (pendingName && pendingSlug) {
            const { data: created } = await supabase
              .from("restaurants")
              .insert({ name: pendingName, slug: pendingSlug, owner_id: userId })
              .select("id, name, slug, status")
              .single();
            setRestaurant(created ?? null);
          } else {
            setRestaurant(null);
          }
        }
      }
      setLoading(false);
    }
    loadRestaurant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isAdmin, overrideId, staff]);

  // New-order alert — badge + chime, live across the whole panel (not just
  // the Orders page), so staff notice an order even while on Menu/Dashboard.
  useEffect(() => {
    setNewOrderCount(0);
    if (!restaurant) return;
    const channel = supabase
      .channel(`panel-new-orders-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` },
        () => {
          setNewOrderCount((n) => n + 1);
          playOrderChime();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  function clearNewOrders() {
    setNewOrderCount(0);
  }

  // Call-waiter alert — same pattern as new orders, its own channel and
  // its own chime so staff can tell the two apart without looking.
  useEffect(() => {
    setWaiterCallCount(0);
    if (!restaurant) return;
    const channel = supabase
      .channel(`panel-waiter-calls-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "waiter_calls", filter: `restaurant_id=eq.${restaurant.id}` },
        () => {
          setWaiterCallCount((n) => n + 1);
          playWaiterChime();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  function clearWaiterCalls() {
    setWaiterCallCount(0);
  }

  const role: Role = staff ? staff.role : isAdmin ? "admin" : restaurant ? "owner" : null;

  return (
    <RestaurantContext.Provider
      value={{ restaurant, isAdmin, role, staffName: staff?.name ?? null, accessDisabled: !!staff && !staff.active, loading, newOrderCount, clearNewOrders, waiterCallCount, clearWaiterCalls }}
    >
      {children}
    </RestaurantContext.Provider>
  );
}

export function useActiveRestaurant() {
  return useContext(RestaurantContext);
}
