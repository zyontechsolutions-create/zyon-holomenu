"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export type ActiveRestaurant = { id: string; name: string; slug: string; status: string } | null;

type RestaurantContextValue = {
  restaurant: ActiveRestaurant;
  isAdmin: boolean;
  loading: boolean;
};

const RestaurantContext = createContext<RestaurantContextValue>({
  restaurant: null,
  isAdmin: false,
  loading: true,
});

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const overrideId = searchParams.get("restaurant");

  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [restaurant, setRestaurant] = useState<ActiveRestaurant>(null);
  const [loading, setLoading] = useState(true);

  // Runs ONCE per session — not on every page switch.
  useEffect(() => {
    async function loadUser() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setLoading(false); return; }
      setUserId(userData.user.id);

      const { data: adminRow } = await supabase
        .from("zyon_admins")
        .select("user_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      setIsAdmin(!!adminRow);
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
  }, [userId, isAdmin, overrideId]);

  return (
    <RestaurantContext.Provider value={{ restaurant, isAdmin, loading }}>
      {children}
    </RestaurantContext.Provider>
  );
}

export function useActiveRestaurant() {
  return useContext(RestaurantContext);
}
