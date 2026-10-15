"use client";
import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useActiveRestaurant } from "@/lib/useActiveRestaurant";
import { FileImage, FileCode2, Printer, Layers, ImagePlus, Trash2, RotateCcw } from "lucide-react";
import { THEMES, resolveTheme } from "@/lib/printKit/themes";
import { Branding, DEFAULT_BRANDING, FormatId, fileToLogoDataUrl, loadBranding, saveBranding } from "@/lib/printKit/branding";
import { Design, FORMATS, STICKER_SIZES, buildDesign, isSticker } from "@/lib/printKit/designs";
import { downloadPng, downloadSvg, printAll, printDesign } from "@/lib/printKit/export";

type Target = { id: string; label: string; name: string };

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "code";
const inputCls = "w-full border border-ink/15 rounded-md px-3 py-2 text-sm bg-cream focus:outline-none focus:border-gold transition-colors";

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex items-center justify-between gap-3 w-full text-left py-1.5">
      <span className="text-sm">{label}</span>
      <span className={`w-9 h-5 rounded-full relative shrink-0 transition-colors ${on ? "bg-gold" : "bg-ink/20"}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function PrintKitPage() {
  const supabase = createClient();
  const { restaurant } = useActiveRestaurant();
  const [codes, setCodes] = useState<{ id: string; label: string }[]>([]);
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [ready, setReady] = useState(false);
  const [format, setFormat] = useState<FormatId>("round");
  const [sizeMm, setSizeMm] = useState(70);
  const [selected, setSelected] = useState("general");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!restaurant) return;
    setBranding(loadBranding(restaurant.id));
    setReady(true);
    supabase.from("qr_codes").select("id, label").eq("restaurant_id", restaurant.id).order("created_at").then(({ data }) => setCodes(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  useEffect(() => {
    if (!restaurant || !ready) return;
    if (!saveBranding(restaurant.id, branding)) setMsg("Couldn't save your branding in this browser (logo may be too large).");
  }, [branding, ready, restaurant?.id]);

  const update = (patch: Partial<Branding>) => setBranding((b) => ({ ...b, ...patch }));
  const theme = resolveTheme(branding.themeId, branding.accent);

  const targets: Target[] = useMemo(
    () => [{ id: "general", label: "", name: "Restaurant (all-purpose)" }, ...codes.map((c) => ({ id: c.id, label: c.label, name: c.label }))],
    [codes]
  );

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const urlFor = (t: Target) => `${origin}/m/${restaurant?.slug}${t.id === "general" ? "" : `?table=${t.id}`}`;

  // Bulk sheets never carry bleed/marks; single exports follow the print-shop switch.
  const make = (t: Target, uid: string, forceNoShop = false): Design | null => {
    if (!restaurant) return null;
    try {
      return buildDesign({ format, restaurantName: restaurant.name, label: t.label, url: urlFor(t), branding, sizeMm, uid, printShop: forceNoShop ? false : branding.printShop });
    } catch {
      return null;
    }
  };

  const current = targets.find((t) => t.id === selected) ?? targets[0];
  const preview = useMemo(() => (restaurant && current ? make(current, "pkprev") : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [restaurant?.id, restaurant?.name, current?.id, current?.label, format, sizeMm, branding, origin]);

  const thumbs = useMemo(() => (restaurant ? targets.map((t, i) => ({ t, d: make(t, `pkt${i}`, true) })) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [restaurant?.id, restaurant?.name, targets, format, sizeMm, branding, origin]);

  const fname = (ext: string) => `${restaurant?.slug ?? "menu"}-${format}-${slugify(current?.label || "restaurant")}.${ext}`;

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setMsg("");
    try { await fn(); } catch (e) { setMsg(e instanceof Error ? e.message : "Something went wrong. Please try again."); }
    setBusy("");
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { update({ logo: await fileToLogoDataUrl(f) }); setMsg(""); } catch (err) { setMsg(err instanceof Error ? err.message : "Couldn't use that logo."); }
  }

  const sticker = isSticker(format);
  const btn = "flex items-center justify-center gap-2 text-sm border border-ink/15 rounded-md px-3.5 py-2.5 bg-paper hover:border-gold transition-colors disabled:opacity-50";

  if (!restaurant) return <div className="text-sm text-inkSoft">Loading...</div>;

  return (
    <>
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">Stickers · table cards · posters</p>
          <h1 className="panel-title">Print Kit</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
        {/* ---------- Controls ---------- */}
        <div className="space-y-4">
          <div className="section-card">
            <h2>Format</h2>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map((f) => (
                <button key={f.id} onClick={() => setFormat(f.id)}
                  className={`text-left rounded-md border px-3 py-2.5 transition-colors ${format === f.id ? "border-gold bg-creamDeep" : "border-ink/15 hover:border-gold/60"}`}>
                  <span className="block text-sm font-medium">{f.name}</span>
                  <span className="block text-[11px] text-inkSoft mt-0.5">{f.size}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-inkSoft mt-3">{FORMATS.find((f) => f.id === format)?.hint}</p>
            {sticker && (
              <div className="mt-4">
                <label className="text-xs text-inkSoft block mb-1.5">Sticker size</label>
                <select value={sizeMm} onChange={(e) => setSizeMm(Number(e.target.value))} className={inputCls}>
                  {STICKER_SIZES.map((s) => <option key={s} value={s}>{s} mm ({(s / 25.4).toFixed(1)} in)</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="section-card">
            <h2>Brand</h2>
            <label className="text-xs text-inkSoft block mb-2">Colour theme</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {THEMES.map((t) => (
                <button key={t.id} onClick={() => update({ themeId: t.id })} title={t.name} aria-label={t.name}
                  className={`w-9 h-9 rounded-full border-2 transition-all ${branding.themeId === t.id ? "border-gold scale-110" : "border-transparent"}`}
                  style={{ background: `linear-gradient(135deg, ${t.bg} 55%, ${t.accent} 55%)`, boxShadow: "0 0 0 1px rgba(30,27,22,0.18)" }} />
              ))}
            </div>
            <div className="flex items-center gap-3 mb-4">
              <input type="color" value={theme.accent} onChange={(e) => update({ accent: e.target.value })} className="w-9 h-9 rounded border border-ink/15 bg-transparent p-0.5" aria-label="Accent colour" />
              <span className="text-sm flex-1">Accent colour</span>
              {branding.accent && <button onClick={() => update({ accent: "" })} className="text-xs text-goldDeep flex items-center gap-1"><RotateCcw size={12} /> Reset</button>}
            </div>

            <label className="text-xs text-inkSoft block mb-1.5">Logo</label>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full border border-ink/15 bg-white flex items-center justify-center overflow-hidden shrink-0">
                {branding.logo ? <img src={branding.logo} alt="" className="w-full h-full object-contain" /> : <span className="text-[10px] text-inkSoft">None</span>}
              </div>
              <button onClick={() => fileRef.current?.click()} className="text-sm flex items-center gap-1.5 text-goldDeep"><ImagePlus size={15} /> {branding.logo ? "Replace" : "Upload"}</button>
              {branding.logo && <button onClick={() => update({ logo: null })} className="text-sm flex items-center gap-1.5 text-red-600"><Trash2 size={14} /> Remove</button>}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={onLogo} className="hidden" />
            </div>
            <p className="text-[11px] text-inkSoft -mt-2 mb-4">Square PNG with a transparent background works best. Without a logo we use your initials.</p>

            <label className="text-xs text-inkSoft block mb-1.5">Headline</label>
            <input value={branding.headline} maxLength={28} onChange={(e) => update({ headline: e.target.value })} placeholder="Scan to Order" className={`${inputCls} mb-3`} />
            <label className="text-xs text-inkSoft block mb-1.5">Tagline</label>
            <input value={branding.tagline} maxLength={60} onChange={(e) => update({ tagline: e.target.value })} placeholder="e.g. Wood-fired North Indian kitchen" className={`${inputCls} mb-3`} />
            <label className="text-xs text-inkSoft block mb-1.5">Footer line (cards &amp; posters)</label>
            <input value={branding.footer} maxLength={70} onChange={(e) => update({ footer: e.target.value })} placeholder="@yourhandle  ·  Wi-Fi: password" className={inputCls} />
          </div>

          <div className="section-card">
            <h2>Options</h2>
            <Toggle on={branding.showAr} onChange={(v) => update({ showAr: v })} label="Mention 3D dish previews" />
            <Toggle on={branding.showPoweredBy} onChange={(v) => update({ showPoweredBy: v })} label="“Powered by Zyon HoloMenu” credit" />
            <Toggle on={branding.printShop} onChange={(v) => update({ printShop: v })} label="Print-shop mode (3 mm bleed + cut line / crop marks)" />
          </div>
        </div>

        {/* ---------- Preview & export ---------- */}
        <div className="space-y-4 min-w-0">
          <div className="section-card" style={{ background: theme.id === "ivory" ? "#EDE4CF" : "#EFE8D6" }}>
            <div className="mx-auto" style={{ maxWidth: sticker ? 440 : format === "poster" ? 400 : 340 }}>
              {preview ? (
                <div className="[&_svg]:w-full [&_svg]:h-auto [&_svg]:block drop-shadow-[0_18px_28px_rgba(30,27,22,0.28)]" dangerouslySetInnerHTML={{ __html: preview.svg }} />
              ) : (
                <p className="text-sm text-inkSoft text-center py-16">Couldn&apos;t build this design. Please refresh and try again.</p>
              )}
            </div>
            {preview && (
              <p className="text-center text-xs text-inkSoft mt-4">
                Finished size {preview.trimWidthMm.toFixed(0)} × {preview.trimHeightMm.toFixed(0)} mm
                {branding.printShop && ` · file ${preview.widthMm.toFixed(0)} × ${preview.heightMm.toFixed(0)} mm incl. bleed`}
              </p>
            )}
          </div>

          <div className="section-card">
            <h2>Export · {current?.name}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button className={btn} disabled={!preview || !!busy} onClick={() => preview && run("print", () => printDesign(preview))}><Printer size={15} /> {busy === "print" ? "Opening…" : "Print / PDF"}</button>
              <button className={btn} disabled={!preview || !!busy} onClick={() => preview && run("png", () => downloadPng(preview, fname("png")))}><FileImage size={15} /> {busy === "png" ? "Rendering…" : "PNG 300dpi"}</button>
              <button className={btn} disabled={!preview || !!busy} onClick={() => preview && run("svg", () => downloadSvg(preview, fname("svg")))}><FileCode2 size={15} /> {busy === "svg" ? "Preparing…" : "SVG vector"}</button>
              <button className={btn} disabled={!!busy || thumbs.length === 0}
                onClick={() => run("all", () => printAll(thumbs.map((x) => x.d).filter((d): d is Design => !!d), sticker, sizeMm))}>
                <Layers size={15} /> {busy === "all" ? "Opening…" : `Print all (${targets.length})`}
              </button>
            </div>
            <p className="text-xs text-inkSoft mt-3">
              Choose <b>Save as PDF</b> in the print dialog for a file. Send the SVG to a print shop for sharp results at any size.
              {sticker ? " “Print all” packs stickers onto A4 sheets." : " “Print all” prints one per page."}
            </p>
            {msg && <p className="text-xs text-red-600 mt-2">{msg}</p>}
          </div>

          <div className="section-card">
            <h2>Pick a code to preview</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-3">
              {thumbs.map(({ t, d }) => (
                <button key={t.id} onClick={() => setSelected(t.id)}
                  className={`rounded-md border p-1.5 text-center transition-colors ${current?.id === t.id ? "border-gold bg-creamDeep" : "border-ink/10 hover:border-gold/60"}`}>
                  {d && <div className="[&_svg]:w-full [&_svg]:h-auto [&_svg]:block" dangerouslySetInnerHTML={{ __html: d.svg }} />}
                  <span className="block text-[11px] mt-1.5 truncate">{t.id === "general" ? "Restaurant" : t.label}</span>
                </button>
              ))}
            </div>
            {codes.length === 0 && <p className="text-xs text-inkSoft mt-3">Add tables on the QR Codes page and they&apos;ll appear here automatically.</p>}
          </div>
        </div>
      </div>
    </>
  );
}

export default function PrintKitPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-inkSoft">Loading...</div>}>
      <PrintKitPage />
    </Suspense>
  );
}
