"use client";
import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useActiveRestaurant } from "@/lib/useActiveRestaurant";
import { QRCodeCanvas } from "qrcode.react";
import { Plus, Download, Trash2 } from "lucide-react";

type QrCode = { id: string; label: string; scans_count: number; status: string };

function QrCodesPage() {
  const supabase = createClient();
  const { restaurant } = useActiveRestaurant();
  const [codes, setCodes] = useState<QrCode[]>([]);
  const [label, setLabel] = useState("");

  async function load(rid: string) {
    const { data } = await supabase.from("qr_codes").select("id, label, scans_count, status").eq("restaurant_id", rid);
    setCodes(data ?? []);
  }

  useEffect(() => {
    if (!restaurant) return;
    load(restaurant.id);
    const channel = supabase
      .channel("qr-codes-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qr_codes", filter: `restaurant_id=eq.${restaurant.id}` },
        () => load(restaurant.id)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  async function addCode(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurant || !label) return;
    await supabase.from("qr_codes").insert({ restaurant_id: restaurant.id, label });
    setLabel("");
    load(restaurant.id);
  }

  async function deleteCode(id: string, name: string) {
    const ok = window.confirm(`Delete QR code "${name}"? This can't be undone — you'll need to reprint it if you change your mind.`);
    if (!ok || !restaurant) return;
    await supabase.from("qr_codes").delete().eq("id", id);
    load(restaurant.id);
  }

  async function toggleStatus(id: string, current: string) {
    if (!restaurant) return;
    const next = current === "available" ? "occupied" : "available";
    await supabase.from("qr_codes").update({ status: next }).eq("id", id);
    load(restaurant.id);
  }

  function downloadQr(id: string, name: string) {
    const canvas = document.getElementById(`qr-${id}`) as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${name}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  const menuUrl = (qrId: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/m/${restaurant?.slug}?table=${qrId}`;

  return (
    <>
        <div className="panel-header">
          <div>
            <p className="panel-eyebrow">Print &amp; place on tables</p>
            <h1 className="panel-title">QR Codes</h1>
          </div>
        </div>

        <form onSubmit={addCode} className="flex gap-2 max-w-sm mb-8">
          <input
            placeholder="e.g. Table 4"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="flex-1 border border-ink/15 rounded-md px-3.5 py-2.5 text-sm bg-cream focus:outline-none focus:border-gold transition-colors"
          />
          <button type="submit" className="btn-gold flex items-center gap-2 px-4">
            <Plus size={15} /> Generate
          </button>
        </form>

        <div className="grid grid-cols-3 gap-4">
          {codes.map((code, i) => (
            <div key={code.id} className="qr-tile fade-up" style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}>
              <QRCodeCanvas id={`qr-${code.id}`} value={menuUrl(code.id)} size={140} includeMargin />
              <div className="flex items-center gap-2 mt-3.5">
                <p className="text-sm font-medium">{code.label}</p>
                <span
                  className="status-pill"
                  style={{
                    background: code.status === "occupied" ? "#fbe4e4" : "#e1f0e5",
                    color: code.status === "occupied" ? "#b23b3b" : "#1c7a44",
                  }}
                >
                  {code.status === "occupied" ? "Occupied" : "Available"}
                </span>
              </div>
              <p className="text-xs text-inkSoft mt-1">{code.scans_count} scans</p>
              <button
                onClick={() => toggleStatus(code.id, code.status)}
                className="text-xs text-goldDeep hover:opacity-70 transition-opacity mt-1"
              >
                Mark {code.status === "occupied" ? "available" : "occupied"}
              </button>
              <div className="mt-3.5 flex items-center gap-4">
                <button
                  onClick={() => downloadQr(code.id, code.label)}
                  className="text-xs flex items-center gap-1.5 text-goldDeep hover:opacity-70 transition-opacity"
                >
                  <Download size={13} /> Download
                </button>
                <button
                  onClick={() => deleteCode(code.id, code.label)}
                  className="text-xs flex items-center gap-1.5 text-red-600 hover:opacity-70 transition-opacity"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        {codes.length === 0 && (
          <div className="section-card text-center py-12">
            <p className="text-sm text-inkSoft">No QR codes yet — generate one for each table.</p>
          </div>
        )}
      </>
  );
}

export default function QrCodesPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-inkSoft">Loading...</div>}>
      <QrCodesPage />
    </Suspense>
  );
}
