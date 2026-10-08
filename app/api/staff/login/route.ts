import { NextResponse } from "next/server";
import { adminClient, anonClient, staffPassword, USERNAME_RE } from "@/lib/staffServer";

// One message for every failure so nobody can learn which restaurants/usernames exist.
const DENIED = "Incorrect details, or too many attempts. Please try again in a few minutes.";
const deny = () => NextResponse.json({ error: DENIED }, { status: 401 });

export async function POST(req: Request) {
  try {
    const admin = adminClient();
    const anon = anonClient();
    if (!admin || !anon) return NextResponse.json({ error: "Staff login isn't set up on the server yet." }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const slug = String(body.restaurant ?? "").trim().toLowerCase();
    const username = String(body.username ?? "").trim().toLowerCase();
    const pin = String(body.pin ?? "").trim();

    if (!slug || !USERNAME_RE.test(username) || !/^\d{6}$/.test(pin)) return deny();

    const { data: restaurant } = await admin.from("restaurants").select("id").eq("slug", slug).maybeSingle();
    if (!restaurant) return deny();

    const { data: staff } = await admin
      .from("staff")
      .select("id, user_id, role, active, locked_until")
      .eq("restaurant_id", restaurant.id)
      .eq("username", username)
      .maybeSingle();
    if (!staff || !staff.active) return deny();

    if (staff.locked_until) {
      if (new Date(staff.locked_until).getTime() > Date.now()) return deny();
      await admin.rpc("staff_note_success", { p_staff: staff.id }); // lock expired: fresh start
    }

    const { data: authUser } = await admin.auth.admin.getUserById(staff.user_id);
    const email = authUser?.user?.email;
    if (!email) return deny();

    const { data: signIn, error } = await anon.auth.signInWithPassword({ email, password: staffPassword(pin) });
    if (error || !signIn.session) {
      await admin.rpc("staff_note_failure", { p_staff: staff.id });
      return deny();
    }

    await admin.rpc("staff_note_success", { p_staff: staff.id });
    return NextResponse.json({
      ok: true,
      role: staff.role,
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    });
  } catch (e) {
    console.error("staff login error:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
