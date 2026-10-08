import { NextResponse } from "next/server";
import {
  adminClient, getCaller, canManageRestaurant, makePin, staffPassword, syntheticEmail,
  USERNAME_RE, STAFF_ROLES, MAX_STAFF_PER_RESTAURANT,
} from "@/lib/staffServer";

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(req: Request) {
  try {
    const admin = adminClient();
    if (!admin) return fail("Staff accounts aren't configured on the server yet (missing service key).", 500);

    const caller = await getCaller(req, admin);
    if (!caller) return fail("Please sign in again.", 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    // ---------- CREATE ----------
    if (action === "create") {
      const restaurantId = String(body.restaurant_id ?? "");
      const name = String(body.name ?? "").trim();
      const username = String(body.username ?? "").trim().toLowerCase();
      const role = String(body.role ?? "");

      if (!restaurantId || !(await canManageRestaurant(admin, caller.id, restaurantId))) return fail("Not allowed.", 403);
      if (name.length < 1 || name.length > 60) return fail("Enter the person's name (up to 60 characters).");
      if (!USERNAME_RE.test(username)) return fail("Username must be 3–20 characters: lowercase letters, numbers, dot, dash or underscore.");
      if (!(STAFF_ROLES as readonly string[]).includes(role)) return fail("Choose Kitchen or Cashier.");

      const { count } = await admin.from("staff").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId);
      if ((count ?? 0) >= MAX_STAFF_PER_RESTAURANT) return fail(`You can add up to ${MAX_STAFF_PER_RESTAURANT} staff accounts.`);

      const { data: dup } = await admin.from("staff").select("id").eq("restaurant_id", restaurantId).eq("username", username).maybeSingle();
      if (dup) return fail("That username is already used in your restaurant.", 409);

      const pin = makePin();
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: syntheticEmail(),
        password: staffPassword(pin),
        email_confirm: true,
        user_metadata: { staff: true, display_name: name },
      });
      if (createErr || !created.user) {
        console.error("staff createUser failed:", createErr?.message);
        return fail("Couldn't create the login. Please try again.", 500);
      }

      const { data: row, error: insErr } = await admin
        .from("staff")
        .insert({ restaurant_id: restaurantId, user_id: created.user.id, name, username, role })
        .select("id, name, username, role, active")
        .single();
      if (insErr || !row) {
        await admin.auth.admin.deleteUser(created.user.id); // roll back, leave nothing half-made
        console.error("staff insert failed:", insErr?.message);
        return fail(insErr?.code === "23505" ? "That username is already used in your restaurant." : "Couldn't save the staff member.", insErr?.code === "23505" ? 409 : 500);
      }
      return NextResponse.json({ ok: true, staff: row, pin });
    }

    // ---------- Actions on an existing staff member ----------
    const staffId = String(body.staff_id ?? "");
    if (!staffId) return fail("Missing staff member.");
    const { data: target } = await admin.from("staff").select("id, user_id, restaurant_id").eq("id", staffId).maybeSingle();
    if (!target || !(await canManageRestaurant(admin, caller.id, target.restaurant_id))) return fail("Not allowed.", 403);

    if (action === "reset_pin") {
      const pin = makePin();
      const { error } = await admin.auth.admin.updateUserById(target.user_id, { password: staffPassword(pin) });
      if (error) { console.error("reset pin failed:", error.message); return fail("Couldn't reset the PIN.", 500); }
      await admin.from("staff").update({ failed_attempts: 0, locked_until: null }).eq("id", target.id);
      return NextResponse.json({ ok: true, pin });
    }

    if (action === "set_active") {
      const active = body.active === true;
      // Database rules check `active` on every request, so this takes effect immediately.
      const { error: upErr } = await admin.from("staff").update({ active }).eq("id", target.id);
      if (upErr) return fail("Couldn't update the account.", 500);
      await admin.auth.admin.updateUserById(target.user_id, { ban_duration: active ? "none" : "876000h" });
      return NextResponse.json({ ok: true });
    }

    if (action === "remove") {
      await admin.from("staff").update({ active: false }).eq("id", target.id); // cut access first
      const { error } = await admin.auth.admin.deleteUser(target.user_id);
      if (error) { console.error("delete staff failed:", error.message); return fail("Couldn't remove the account.", 500); }
      await admin.from("staff").delete().eq("id", target.id);
      return NextResponse.json({ ok: true });
    }

    return fail("Unknown action.");
  } catch (e) {
    console.error("staff manage error:", e);
    return fail("Something went wrong. Please try again.", 500);
  }
}
