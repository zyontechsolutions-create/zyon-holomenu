"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export type ActiveRestaurant = { id: string; name: string; slug: string } | null;

export function useActiveRestaurant() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const overrideId = searchParams.get("restaurant");

  const [restaurant, setRestaurant] = useState<ActiveRestaurant>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setLoading(false); return; }

      const { data: adminRow } = await supabase
        .from("zyon_admins")
        .select("user_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      const admin = !!adminRow;
      setIsAdmin(admin);

      if (overrideId && admin) {
        // Admin viewing a specific client restaurant
        const { data: r } = await supabase
          .from("restaurants")
          .select("id, name, slug")
          .eq("id", overrideId)
          .single();
        setRestaurant(r ?? null);
      } else {
        // Normal case: the restaurant this login owns
        const { data: r } = await supabase
          .from("restaurants")
          .select("id, name, slug")
          .eq("owner_id", userData.user.id)
          .single();
        setRestaurant(r ?? null);
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrideId]);

  return { restaurant, isAdmin, loading };
}
