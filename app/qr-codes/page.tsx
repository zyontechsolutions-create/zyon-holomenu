"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import Sidebar from "@/components/Sidebar";
import { QRCodeCanvas } from "qrcode.react";
import { Plus, Download } from "lucide-react";

type QrCode = { id: string; label: string; scans_count: number };

export default function QrCodesPage() {
  const supabase = createClient();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [codes, setCodes] = useState<QrCode[]>([]);
  const [label, setLabel] = useState("");

  async function load(rid: string) {
    const { data } = await supabase.from("qr_codes").select("id, label, scans_count").eq("restaurant_id", rid);
    setCodes(data ?? []);
  }

  useEffect(() => {
    async function init() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("id, slug")
        .eq("owner_id", userData.user.id)
        .single();
      if (restaurant) {
        setRestaurantId(restaurant.id);
        setSlug(restaurant.slug);
        load(restaurant.id);
      }
    }
    init();
  }, []);

  async function addCode(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurantId || !label) return;
    await supabase.from("qr_codes").insert({ restaurant_id: restaurantId, label });
    setLabel("");
    load(restaurantId);
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
    `${typeof window !== "undefined" ? window.location.origin : ""}/m/${slug}?table=${qrId}`;

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
