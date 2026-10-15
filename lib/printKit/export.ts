// Export helpers: embed brand fonts, download SVG / 300-dpi PNG, print or
// "Save as PDF" at exact physical size. Browser-only.

import { Design, sheetLayout } from "./designs";

const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Jost:wght@400;600&display=swap";

let fontCssPromise: Promise<string> | null = null;

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("read failed"));
    r.readAsDataURL(b);
  });
}

// Downloads the Latin subset of the brand fonts once and inlines them as
// base64 so exported SVG/PNG/PDF look identical on any machine. If offline,
// returns "" and designs fall back to Georgia / Helvetica.
export function getFontCss(): Promise<string> {
  if (!fontCssPromise) {
    fontCssPromise = (async () => {
      try {
        const css = await (await fetch(FONT_CSS_URL)).text();
        const blocks = css.split("/* ").slice(1).filter((b) => b.indexOf("latin */") === 0);
        const out: string[] = [];
        for (const block of blocks) {
          const m = /url\((https:[^)]+)\)/.exec(block);
          if (!m) continue;
          const data = await blobToDataUrl(await (await fetch(m[1])).blob());
          out.push("@font-face" + block.slice(block.indexOf("{")).replace(m[1], data).split("}")[0] + "}");
        }
        return out.join("\n");
      } catch {
        fontCssPromise = null; // allow a retry next time
        return "";
      }
    })();
  }
  return fontCssPromise;
}

export function withFonts(svg: string, fontCss: string): string {
  return fontCss ? svg.replace("<defs>", `<defs><style>${fontCss}</style>`) : svg;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function downloadSvg(d: Design, filename: string) {
  const svg = withFonts(d.svg, await getFontCss());
  downloadBlob(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`], { type: "image/svg+xml" }), filename);
}

export async function downloadPng(d: Design, filename: string, dpi = 300) {
  const svg = withFonts(d.svg, await getFontCss());
  const wPx = Math.round((d.widthMm / 25.4) * dpi);
  const hPx = Math.round((d.heightMm / 25.4) * dpi);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = wPx;
    canvas.height = hPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    const draw = () => { ctx.clearRect(0, 0, wPx, hPx); ctx.drawImage(img, 0, 0, wPx, hPx); };
    draw();
    await new Promise((r) => setTimeout(r, 80)); // let embedded fonts settle, then redraw
    draw();
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error("PNG export failed");
    downloadBlob(blob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- printing ----------
function printDocument(html: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    if (!win) { iframe.remove(); resolve(); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    const go = () => {
      try { win.focus(); win.print(); } catch { /* print blocked */ }
      setTimeout(() => { iframe.remove(); resolve(); }, 2000);
    };
    const fonts = (win.document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    setTimeout(() => (fonts ? fonts.ready.then(() => setTimeout(go, 150), go) : go()), 300);
  });
}

// One design, printed at its exact physical size (choose "Save as PDF" in the dialog).
export async function printDesign(d: Design) {
  const svg = withFonts(d.svg, await getFontCss());
  await printDocument(
    `<!doctype html><html><head><meta charset="utf-8"><title>Print</title><style>
@page{size:${d.widthMm}mm ${d.heightMm}mm;margin:0}
html,body{margin:0;padding:0}
svg{display:block;width:${d.widthMm}mm;height:${d.heightMm}mm}
</style></head><body>${svg}</body></html>`
  );
}

// Every table in one go. Stickers are packed onto A4 sheets; cards and posters print one per page.
export async function printAll(designs: Design[], sticker: boolean, sizeMm: number) {
  if (designs.length === 0) return;
  const fontCss = await getFontCss();
  const svgs = designs.map((d) => withFonts(d.svg, fontCss));
  let html: string;
  if (sticker) {
    const { cols, rows, gap } = sheetLayout(sizeMm);
    const per = cols * rows;
    const pages: string[] = [];
    for (let i = 0; i < svgs.length; i += per) {
      pages.push(`<div class="pg">${svgs.slice(i, i + per).join("")}</div>`);
    }
    html = `<!doctype html><html><head><meta charset="utf-8"><title>Sticker sheets</title><style>
@page{size:A4;margin:0}
html,body{margin:0;padding:0}
.pg{box-sizing:border-box;width:210mm;height:296mm;padding:8mm;display:grid;grid-template-columns:repeat(${cols},${sizeMm}mm);grid-auto-rows:${sizeMm}mm;gap:${gap}mm;justify-content:center;align-content:start;page-break-after:always;break-after:page}
.pg:last-child{page-break-after:auto;break-after:auto}
svg{display:block;width:${sizeMm}mm;height:${sizeMm}mm}
</style></head><body>${pages.join("")}</body></html>`;
  } else {
    const d = designs[0];
    html = `<!doctype html><html><head><meta charset="utf-8"><title>Print</title><style>
@page{size:${d.widthMm}mm ${d.heightMm}mm;margin:0}
html,body{margin:0;padding:0}
.pg{width:${d.widthMm}mm;height:${d.heightMm}mm;overflow:hidden;page-break-after:always;break-after:page}
.pg:last-child{page-break-after:auto;break-after:auto}
svg{display:block;width:${d.widthMm}mm;height:${d.heightMm}mm}
</style></head><body>${svgs.map((s) => `<div class="pg">${s}</div>`).join("")}</body></html>`;
  }
  await printDocument(html);
}
