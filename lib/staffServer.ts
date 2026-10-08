// SERVER-ONLY helpers for staff accounts. Never import this from a client component:
// it uses the Supabase service-role key, which must never reach the browser.
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { randomBytes, randomInt } from "crypto";

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,19}$/;
export const STAFF_ROLES = ["kitchen", "cashier"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const MAX_STAFF_PER_RESTAURANT = 10;

export function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

// Random 6-digit PIN, re-rolled if it is obviously guessable (000000, 123456, 121212 ...)
export function makePin(): string {
  for (;;) {
    const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const same = /^(\d)\1{5}$/.test(pin);
    const run = "0123456789".includes(pin) || "9876543210".includes(pin);
    const pattern = /^(\d{2})\1\1$/.test(pin) || /^(\d{3})\1$/.test(pin);
    if (!same && !run && !pattern) return pin;
  }
}

// The PIN is wrapped before it becomes the Supabase password so it always meets
// password-strength rules. Login happens only through our server, which applies
// the same wrapping.
export function staffPassword(pin: string) {
  return `Zy!${pin}-hm`;
}

// Staff have no mailbox. This random address can never receive mail (example.com is
// reserved) and is never shown to anyone, so it cannot be used to reset a password.
export function syntheticEmail() {
  return `staff-${randomBytes(16).toString("hex")}@example.com`;
}

export async function getCaller(req: Request, admin: SupabaseClient): Promise<User | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// Only the restaurant's owner, or a Zyon admin, may manage its staff.
export async function canManageRestaurant(admin: SupabaseClient, userId: string, restaurantId: string) {
  const { data: owned } = await admin
    .from("restaurants")
    .select("id")
    .eq("id", restaurantId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (owned) return true;
  const { data: adminRow } = await admin.from("zyon_admins").select("user_id").eq("user_id", userId).maybeSingle();
  return !!adminRow;
}
