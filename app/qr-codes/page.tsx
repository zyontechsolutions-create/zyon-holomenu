"use client";
import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useActiveRestaurant } from "@/lib/useActiveRestaurant";
import Sidebar from "@/components/Sidebar";
import { QRCodeCanvas } from "qrcode.react";
import { Plus, Download } from "lucide-react";

type QrCode = { id: string; label: string; scans_count: number };

function QrCodesPage() {
  const supabase = createClient();
  const { restaurant } = useActiveRestaurant();
  const [codes, setCodes] = useState<QrCode[]>([]);
  const [label, setLabel] = useState("");

  async function load(rid: string) {
    const { data } = await supabase.from("qr_codes").select("id, label, scans_count").eq("restaurant_id", rid);
    setCodes(data ?? []);
  }

  useEffect(() => {
    if (restaurant) load(restaurant.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  async function addCode(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurant || !label) return;
    await supabase.from("qr_codes").insert({ restaurant_id: restaurant.id, label });
    setLabel("");
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
    <div className="panel-shell">
      <Sidebar />
      <main className="panel-main">
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
              <p className="text-sm font-medium mt-3.5">{code.label}</p>
              <p className="text-xs text-inkSoft mt-1">{code.scans_count} scans</p>
              <button
                onClick={() => downloadQr(code.id, code.label)}
                className="mt-3.5 text-xs flex items-center gap-1.5 text-goldDeep hover:opacity-70 transition-opacity"
              >
                <Download size={13} /> Download
              </button>
            </div>
          ))}
        </div>
        {codes.length === 0 && (
          <div className="section-card text-center py-12">
            <p className="text-sm text-inkSoft">No QR codes yet — generate one for each table.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function QrCodesPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-inkSoft">Loading...</div>}>
      <QrCodesPage />
    </Suspense>
  );
}
