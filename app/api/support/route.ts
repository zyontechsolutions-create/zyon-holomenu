import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const SUPPORT_INBOX = "zyontechsolutions@gmail.com";

export async function POST(req: Request) {
  try {
    const { name, email, message } = await req.json();

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "Name, email, and message are all required." }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: ticket, error: dbError } = await supabase
      .from("support_tickets")
      .insert({ name: name.trim(), email: email.trim(), message: message.trim() })
      .select("id")
      .single();

    if (dbError) {
      return NextResponse.json({ error: "Couldn't save your ticket. Please try again." }, { status: 500 });
    }

    // Email notification is best-effort — the ticket is already saved and
    // visible in the admin inbox even if this part fails (e.g. missing
    // API key), so we don't fail the whole request over it.
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Zyon HoloMenu <onboarding@resend.dev>",
          to: SUPPORT_INBOX,
          replyTo: email.trim(),
          subject: `New support ticket from ${name.trim()}`,
          text: `From: ${name.trim()} <${email.trim()}>\nTicket ID: ${ticket?.id}\n\n${message.trim()}`,
        });
      } catch {
        // Swallow — the ticket itself is already safely stored.
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
