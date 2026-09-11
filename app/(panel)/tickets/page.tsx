"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { Mail, Check } from "lucide-react";

type Ticket = { id: string; name: string; email: string; message: string; status: string; created_at: string };

export default function TicketsPage() {
  const supabase = createClient();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: adminRow } = await supabase
      .from("zyon_admins").select("user_id").eq("user_id", userData.user.id).maybeSingle();
    if (!adminRow) { setIsAdmin(false); return; }
    setIsAdmin(true);

    const { data } = await supabase
      .from("support_tickets").select("id, name, email, message, status, created_at")
      .order("created_at", { ascending: false });
    setTickets(data ?? []);
  }

  useEffect(() => { load(); }, []);

  async function resolveTicket(id: string) {
    await supabase.from("support_tickets").update({ status: "resolved" }).eq("id", id);
    load();
  }

  if (isAdmin === false) {
    return <p className="text-sm text-inkSoft">This page is for Zyon admins only.</p>;
  }
  if (isAdmin === null) {
    return <p className="text-sm text-inkSoft">Loading...</p>;
  }

  const open = tickets.filter((t) => t.status === "open");
  const resolved = tickets.filter((t) => t.status === "resolved");

  return (
    <>
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">Zyon Admin</p>
          <h1 className="panel-title">Support Tickets</h1>
        </div>
      </div>

      <div className="space-y-2.5">
        {open.map((t) => (
          <div key={t.id} className="list-row" style={{ alignItems: "flex-start", borderColor: "rgba(184,135,63,0.4)" }}>
            <div className="w-10 h-10 rounded-md bg-creamDeep flex items-center justify-center text-goldDeep shrink-0">
              <Mail size={16} strokeWidth={1.6} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {t.name} <span className="text-xs text-inkSoft font-normal">· {t.email}</span>
              </p>
              <p className="text-sm mt-1" style={{ whiteSpace: "pre-wrap" }}>{t.message}</p>
              <p className="text-xs text-inkSoft mt-1.5">{new Date(t.created_at).toLocaleString()}</p>
            </div>
            <span className="status-pill status-new">Open</span>
            <button
              onClick={() => resolveTicket(t.id)}
              className="p-2 text-inkSoft hover:text-green-700 transition-colors"
              aria-label="Mark resolved"
            >
              <Check size={17} />
            </button>
          </div>
        ))}

        {open.length === 0 && (
          <div className="section-card text-center py-12">
            <p className="text-sm text-inkSoft">No open tickets.</p>
          </div>
        )}

        {resolved.length > 0 && (
          <>
            <p className="text-xs uppercase tracking-wide text-inkSoft mt-6 mb-2" style={{ letterSpacing: 1 }}>
              Resolved
            </p>
            {resolved.slice(0, 20).map((t) => (
              <div key={t.id} className="list-row" style={{ alignItems: "flex-start", opacity: 0.6 }}>
                <div className="w-10 h-10 rounded-md bg-creamDeep flex items-center justify-center text-inkSoft shrink-0">
                  <Mail size={16} strokeWidth={1.6} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {t.name} <span className="text-xs text-inkSoft font-normal">· {t.email}</span>
                  </p>
                  <p className="text-sm mt-1" style={{ whiteSpace: "pre-wrap" }}>{t.message}</p>
                  <p className="text-xs text-inkSoft mt-1.5">{new Date(t.created_at).toLocaleString()}</p>
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
