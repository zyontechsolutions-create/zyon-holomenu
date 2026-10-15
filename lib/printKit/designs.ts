// Print Kit design engine. Every design is generated as ONE self-contained SVG
// string, so the same artwork can be previewed on screen, exported as vector
// SVG for a print shop, rasterised to a 300-dpi PNG, or sent to the printer.

import { resolveTheme, Theme } from "./themes";
import { Branding, FormatId } from "./branding";
import { makeQr } from "./qr";

export type DesignInput = {
  format: FormatId;
  restaurantName: string;
  label: string;      // "Table 4" — empty string for the all-purpose restaurant code
  url: string;        // the menu link the QR code opens
  branding: Branding;
  sizeMm: number;     // physical size, stickers only (cards & posters are fixed)
  uid: string;        // unique prefix so several SVGs can share one HTML page
  printShop?: boolean;// overrides branding.printShop (bulk sheets force it off)
};

export type Design = {
  svg: string;
  widthMm: number;    // full canvas incl. bleed / marks
  heightMm: number;
  trimWidthMm: number;// finished size after cutting
  trimHeightMm: number;
};

export const FORMATS: { id: FormatId; name: string; size: string; hint: string }[] = [
  { id: "round", name: "Round sticker", size: "50–100 mm", hint: "Tables, takeaway bags, windows" },
  { id: "square", name: "Square sticker", size: "50–100 mm", hint: "Menus, counters, delivery boxes" },
  { id: "card", name: "Table card", size: "A6 · 105×148 mm", hint: "Stand on every table" },
  { id: "poster", name: "Poster", size: "A4 · 210×297 mm", hint: "Entrance, wall, counter" },
];

export const STICKER_SIZES = [50, 60, 70, 80, 100];

const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";
const SANS = "'Jost', 'Helvetica Neue', Arial, sans-serif";

// ---------- small helpers ----------
const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (v: string) => String(v).replace(/[&<>"']/g, (c) => ESC[c]);
const n = (x: number) => String(Math.round(x * 100) / 100);

type TextOpts = { size: number; fill: string; family?: "serif" | "sans"; weight?: number; anchor?: "start" | "middle" | "end"; ls?: number; opacity?: number };

function txt(x: number, y: number, s: string, o: TextOpts): string {
  return `<text x="${n(x)}" y="${n(y)}" font-family="${o.family === "serif" ? SERIF : SANS}" font-size="${n(o.size)}" font-weight="${o.weight ?? 400}" fill="${o.fill}" text-anchor="${o.anchor ?? "middle"}"${o.ls ? ` letter-spacing="${n(o.ls)}"` : ""}${o.opacity !== undefined ? ` opacity="${o.opacity}"` : ""}>${esc(s)}</text>`;
}

// Font size that keeps `text` inside maxW. `factor` ≈ average glyph width in em.
function fit(text: string, maxW: number, base: number, factor: number, min: number): number {
  return Math.max(min, Math.min(base, maxW / Math.max(1, text.length * factor)));
}

// Splits a long name into at most two balanced lines.
function wrap2(text: string, maxChars: number): string[] {
  const t = text.trim();
  const words = t.split(/\s+/);
  if (t.length <= maxChars || words.length < 2) return [t];
  let best = 1;
  let bestDiff = 1e9;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (d < bestDiff) { bestDiff = d; best = i; }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w) && !/^(the|and|of)$/i.test(w));
  const out = words.slice(0, 2).map((w) => w.replace(/^[^A-Za-z0-9]+/, "").charAt(0).toUpperCase()).join("");
  return out || "•";
}

// ---------- reusable pieces ----------
function nameBlock(lines: string[], cx: number, slotTop: number, slotH: number, maxW: number, baseFs: number, fill: string): string {
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), "");
  const fs = Math.min(fit(longest, maxW, baseFs, 0.56, 30), slotH / (1.14 * lines.length));
  const lineH = fs * 1.14;
  const startY = slotTop + (slotH - lineH * lines.length) / 2 + fs * 0.84;
  return lines.map((l, i) => txt(cx, startY + i * lineH, l, { size: fs, fill, family: "serif", weight: 700 })).join("");
}

function badge(cx: number, cy: number, r: number, th: Theme, logo: string | null, name: string, uid: string): string {
  const ring = `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${th.plate}" stroke="${th.accent}" stroke-width="${n(r * 0.06)}"/>`;
  if (logo) {
    const s = r * 1.5;
    return ring +
      `<clipPath id="${uid}-lc"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.88)}"/></clipPath>` +
      `<image xlink:href="${logo}" x="${n(cx - s / 2)}" y="${n(cy - s / 2)}" width="${n(s)}" height="${n(s)}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${uid}-lc)"/>`;
  }
  const fs = r * 0.95;
  return ring + txt(cx, cy + fs * 0.35, initials(name), { size: fs, fill: th.qr, family: "serif", weight: 700 });
}

function divider(cx: number, y: number, half: number, th: Theme, k: number): string {
  const d = 9 * k;
  return `<g stroke="${th.accent}" stroke-width="${n(2.2 * k)}" fill="none" opacity="0.95">` +
    `<line x1="${n(cx - half)}" y1="${n(y)}" x2="${n(cx - d * 2.2)}" y2="${n(y)}"/>` +
    `<line x1="${n(cx + d * 2.2)}" y1="${n(y)}" x2="${n(cx + half)}" y2="${n(y)}"/></g>` +
    `<rect x="${n(cx - d)}" y="${n(y - d)}" width="${n(d * 2)}" height="${n(d * 2)}" fill="${th.accent}" transform="rotate(45 ${n(cx)} ${n(y)})"/>`;
}

// Light tile + dark QR modules + a proper 4-module quiet zone, with brand corner brackets.
function qrBlock(x: number, y: number, size: number, th: Theme, url: string): string {
  const { cells, d } = makeQr(url);
  const qrSize = (size * cells) / (cells + 8); // 4 modules of quiet zone each side
  const pad = (size - qrSize) / 2;
  const k = qrSize / cells;
  const off = size * 0.045;
  const len = size * 0.1;
  const sw = Math.max(2, size * 0.014);
  const c = (px: number, py: number, dx: number, dy: number) =>
    `<path d="M${n(px)} ${n(py + dy * len)}V${n(py)}H${n(px + dx * len)}"/>`;
  const x0 = x - off, y0 = y - off, x1 = x + size + off, y1 = y + size + off;
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(size)}" height="${n(size)}" rx="${n(size * 0.05)}" fill="${th.plate}"/>` +
    `<path transform="translate(${n(x + pad)} ${n(y + pad)}) scale(${k})" d="${d}" fill="${th.qr}" shape-rendering="crispEdges"/>` +
    `<g fill="none" stroke="${th.accent}" stroke-width="${n(sw)}" stroke-linecap="round" stroke-linejoin="round">` +
    c(x0, y0, 1, 1) + c(x1, y0, -1, 1) + c(x0, y1, 1, -1) + c(x1, y1, -1, -1) + `</g>`;
}

function pill(cx: number, cy: number, h: number, label: string, th: Theme, maxW: number): string {
  const fs = h * 0.5;
  const text = label.toUpperCase();
  const w = Math.min(maxW, Math.max(h * 3, text.length * fs * 0.78 + h * 1.1));
  const f = Math.min(fs, (w - h * 0.9) / Math.max(1, text.length * 0.78));
  return `<rect x="${n(cx - w / 2)}" y="${n(cy - h / 2)}" width="${n(w)}" height="${n(h)}" rx="${n(h / 2)}" fill="${th.accent}"/>` +
    txt(cx, cy + f * 0.35, text, { size: f, fill: th.onAccent, weight: 600, ls: f * 0.12 });
}

// ---------- canvas / bleed / marks ----------
type FrameOpts = { W: number; H: number; upm: number; shape: "circle" | "rrect" | "rect"; radius: number; sticker: boolean; printShop: boolean; th: Theme; uid: string; label: string; body: string };

function frame(o: FrameOpts): Design {
  const { W, H, upm, th, uid } = o;
  const bleed = o.printShop ? 3 * upm : 0;
  const outset = o.printShop ? (o.sticker ? bleed : 10 * upm) : 0;
  const vbW = W + 2 * outset, vbH = H + 2 * outset;

  const shapeEl = (fill: string) => {
    if (o.printShop) return `<rect x="${n(-bleed)}" y="${n(-bleed)}" width="${n(W + 2 * bleed)}" height="${n(H + 2 * bleed)}" fill="${fill}"/>`;
    if (o.shape === "circle") return `<circle cx="${n(W / 2)}" cy="${n(H / 2)}" r="${n(W / 2)}" fill="${fill}"/>`;
    if (o.shape === "rrect") return `<rect width="${n(W)}" height="${n(H)}" rx="${n(o.radius)}" fill="${fill}"/>`;
    return `<rect width="${n(W)}" height="${n(H)}" fill="${fill}"/>`;
  };

  let marks = "";
  if (o.printShop && o.sticker) {
    const sw = 0.12 * upm;
    const cut = o.shape === "circle"
      ? `<circle cx="${n(W / 2)}" cy="${n(H / 2)}" r="${n(W / 2)}"/>`
      : `<rect width="${n(W)}" height="${n(H)}" rx="${n(o.radius)}"/>`;
    marks = `<g id="CutContour" fill="none" stroke="#EC008C" stroke-width="${n(sw)}">${cut}</g>`;
  } else if (o.printShop) {
    const g = 4 * upm, L = 5 * upm, sw = 0.1 * upm;
    const ln = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"/>`;
    marks = `<g id="CropMarks" stroke="#000" stroke-width="${n(sw)}">` +
      [[0, 0, -1, -1], [W, 0, 1, -1], [0, H, -1, 1], [W, H, 1, 1]]
        .map(([cx, cy, sx, sy]) => ln(cx + sx * g, cy, cx + sx * (g + L), cy) + ln(cx, cy + sy * g, cx, cy + sy * (g + L)))
        .join("") + `</g>`;
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${n(-outset)} ${n(-outset)} ${n(vbW)} ${n(vbH)}" width="${n(vbW / upm)}mm" height="${n(vbH / upm)}mm" role="img" aria-label="${esc(o.label)}">` +
    `<defs><linearGradient id="${uid}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${th.bg2}"/><stop offset="1" stop-color="${th.bg}"/></linearGradient>` +
    `<radialGradient id="${uid}-gl" cx="0.5" cy="0.32" r="0.75"><stop offset="0" stop-color="${th.accent}" stop-opacity="0.2"/><stop offset="1" stop-color="${th.accent}" stop-opacity="0"/></radialGradient></defs>` +
    shapeEl(`url(#${uid}-bg)`) + shapeEl(`url(#${uid}-gl)`) + o.body + marks + `</svg>`;

  return { svg, widthMm: vbW / upm, heightMm: vbH / upm, trimWidthMm: W / upm, trimHeightMm: H / upm };
}

// Text set around a circle as individually rotated glyphs (renders identically
// in browsers, PDF and design tools — unlike <textPath>).
function arcText(s: string, cx: number, cy: number, r: number, bottom: boolean, o: { size: number; fill: string; family: "serif" | "sans"; weight: number; ls: number }): string {
  const base = o.family === "serif" ? 0.72 : 0.64;
  const w = (ch: string) => (ch === "I" ? 0.4 : ch === "J" ? 0.55 : ch === " " ? 0.32 : ch === "M" || ch === "W" ? base * 1.3 : ch === "&" ? 0.85 : base) * o.size + o.ls;
  const chars = s.split("");
  const total = chars.reduce((a, c) => a + w(c), 0) - o.ls;
  let pos = -total / 2;
  let out = "";
  for (const ch of chars) {
    const mid = pos + (w(ch) - o.ls) / 2;
    pos += w(ch);
    if (ch === " ") continue;
    const a = mid / r; // radians from the vertical axis
    const x = cx + r * Math.sin(a);
    const y = bottom ? cy + r * Math.cos(a) : cy - r * Math.cos(a);
    const deg = (bottom ? -a : a) * (180 / Math.PI);
    out += `<text x="${n(x)}" y="${n(y)}" transform="rotate(${n(deg)} ${n(x)} ${n(y)})" font-family="${o.family === "serif" ? SERIF : SANS}" font-size="${n(o.size)}" font-weight="${o.weight}" fill="${o.fill}" text-anchor="middle">${esc(ch)}</text>`;
  }
  return out;
}

// ---------- the four formats ----------
function roundSticker(i: DesignInput, th: Theme, ps: boolean): Design {
  const b = i.branding;
  const hasLabel = i.label.trim().length > 0;
  const name = i.restaurantName.toUpperCase();
  const head = (b.headline.trim() || "Scan to Order").toUpperCase();
  const topFs = fit(name, 880, 62, 0.82, 32);
  const botFs = fit(head, 880, 58, 0.82, 30);
  const plate = hasLabel ? 400 : 440;
  const py = hasLabel ? 305 : 300;
  const body =
    `<circle cx="500" cy="500" r="470" fill="none" stroke="${th.accent}" stroke-width="4"/>` +
    `<circle cx="500" cy="500" r="455" fill="none" stroke="${th.accent}" stroke-width="1.5" opacity="0.55"/>` +
    arcText(name, 500, 500, 385, false, { size: topFs, fill: th.ink, family: "serif", weight: 700, ls: topFs * 0.12 }) +
    arcText(head, 500, 500, 437, true, { size: botFs, fill: th.accent, family: "sans", weight: 600, ls: botFs * 0.16 }) +
    `<rect x="82" y="493" width="14" height="14" fill="${th.accent}" transform="rotate(45 89 500)"/><rect x="904" y="493" width="14" height="14" fill="${th.accent}" transform="rotate(45 911 500)"/>` +
    badge(500, 205, 62, th, b.logo, i.restaurantName, i.uid) +
    qrBlock(500 - plate / 2, py, plate, th, i.url) +
    (hasLabel ? pill(500, 790, 76, i.label, th, 340) : "");
  return frame({ W: 1000, H: 1000, upm: 1000 / i.sizeMm, shape: "circle", radius: 0, sticker: true, printShop: ps, th, uid: i.uid, label: `${i.restaurantName} ${i.label}`.trim(), body });
}

function squareSticker(i: DesignInput, th: Theme, ps: boolean): Design {
  const b = i.branding;
  const hasLabel = i.label.trim().length > 0;
  const head = (b.headline.trim() || "Scan to Order").toUpperCase();
  const headFs = fit(head, 800, 50, 0.82, 28);
  const plate = hasLabel ? 410 : 470;
  const py = 335;
  const plateBottom = py + plate;
  const body =
    `<rect x="30" y="30" width="940" height="940" rx="44" fill="none" stroke="${th.accent}" stroke-width="3.5"/>` +
    `<rect x="44" y="44" width="912" height="912" rx="32" fill="none" stroke="${th.accent}" stroke-width="1.3" opacity="0.5"/>` +
    badge(500, 128, 52, th, b.logo, i.restaurantName, i.uid) +
    nameBlock(wrap2(i.restaurantName, 20), 500, 190, 80, 780, 70, th.ink) +
    (b.tagline.trim() ? txt(500, 300, b.tagline.trim().toUpperCase(), { size: fit(b.tagline, 760, 24, 0.7, 15), fill: th.muted, ls: 3 }) : "") +
    qrBlock(500 - plate / 2, py, plate, th, i.url) +
    txt(500, plateBottom + (hasLabel ? 70 : 76), head, { size: headFs, fill: th.accent, weight: 600, ls: headFs * 0.16 }) +
    (hasLabel ? pill(500, plateBottom + 135, 68, i.label, th, 400) : "");
  return frame({ W: 1000, H: 1000, upm: 1000 / i.sizeMm, shape: "rrect", radius: 70, sticker: true, printShop: ps, th, uid: i.uid, label: `${i.restaurantName} ${i.label}`.trim(), body });
}

type PortraitCfg = {
  H: number; upm: number; badgeCy: number; badgeR: number; nameTop: number; nameH: number; nameBase: number;
  tagY: number; divY: number; headY: number; headBase: number; sub1: number; sub2: number; subFs: number;
  plateY: number; plateL: number; plateN: number; pillH: number; footY: number; powY: number; steps: boolean;
};

const CARD: PortraitCfg = {
  H: 1480, upm: 10, badgeCy: 200, badgeR: 70, nameTop: 285, nameH: 120, nameBase: 96, tagY: 440, divY: 485,
  headY: 600, headBase: 104, sub1: 658, sub2: 700, subFs: 30, plateY: 745, plateL: 500, plateN: 540, pillH: 88,
  footY: 1362, powY: 1402, steps: false,
};
const POSTER: PortraitCfg = {
  H: 1485, upm: 5, badgeCy: 170, badgeR: 60, nameTop: 245, nameH: 100, nameBase: 84, tagY: 380, divY: 416,
  headY: 520, headBase: 92, sub1: 566, sub2: 603, subFs: 27, plateY: 655, plateL: 440, plateN: 480, pillH: 84,
  footY: 1385, powY: 1420, steps: true,
};

function portrait(i: DesignInput, th: Theme, ps: boolean, c: PortraitCfg): Design {
  const b = i.branding;
  const W = 1050, cx = 525;
  const hasLabel = i.label.trim().length > 0;
  const head = b.headline.trim() || "Scan to Order";
  const plate = hasLabel ? c.plateL : c.plateN;
  const l1 = b.showAr ? "Browse the menu  ·  Preview dishes in 3D" : "Browse the menu  ·  Order from your seat";
  const l2 = b.showAr ? "Order from your seat  ·  No app needed" : "No app needed — just open your camera";
  const k = c.steps ? 0.9 : 1;

  let steps = "";
  if (c.steps) {
    const items: [string, string][] = [["Scan", "Open your camera & scan"], ["Choose", "Pick dishes, view in 3D"], ["Order", "Send it to the kitchen"]];
    const cy = 1235;
    const xs = [cx - 300, cx, cx + 300];
    steps = `<g stroke="${th.accent}" stroke-width="2" stroke-dasharray="3 7" opacity="0.7"><line x1="${xs[0] + 44}" y1="${cy}" x2="${xs[1] - 44}" y2="${cy}"/><line x1="${xs[1] + 44}" y1="${cy}" x2="${xs[2] - 44}" y2="${cy}"/></g>` +
      items.map(([t, d], idx) =>
        `<circle cx="${xs[idx]}" cy="${cy}" r="30" fill="${th.accent}"/>` +
        txt(xs[idx], cy + 11, String(idx + 1), { size: 32, fill: th.onAccent, family: "serif", weight: 700 }) +
        txt(xs[idx], 1305, t.toUpperCase(), { size: 28, fill: th.ink, weight: 600, ls: 3 }) +
        txt(xs[idx], 1340, d, { size: 22, fill: th.muted })
      ).join("");
  }

  const body =
    `<rect x="36" y="36" width="978" height="${c.H - 72}" rx="18" fill="none" stroke="${th.accent}" stroke-width="3.2"/>` +
    `<rect x="52" y="52" width="946" height="${c.H - 104}" rx="10" fill="none" stroke="${th.accent}" stroke-width="1.2" opacity="0.5"/>` +
    badge(cx, c.badgeCy, c.badgeR, th, b.logo, i.restaurantName, i.uid) +
    nameBlock(wrap2(i.restaurantName, 18), cx, c.nameTop, c.nameH, 840, c.nameBase, th.ink) +
    (b.tagline.trim() ? txt(cx, c.tagY, b.tagline.trim().toUpperCase(), { size: fit(b.tagline, 860, c.steps ? 26 : 30, 0.7, 16), fill: th.muted, ls: 4 }) : "") +
    divider(cx, c.divY, 230, th, k) +
    txt(cx, c.headY, head, { size: fit(head, 880, c.headBase, 0.58, 50), fill: th.ink, family: "serif", weight: 700 }) +
    txt(cx, c.sub1, l1, { size: c.subFs, fill: th.muted, ls: 0.6 }) +
    txt(cx, c.sub2, l2, { size: c.subFs, fill: th.muted, ls: 0.6 }) +
    qrBlock(cx - plate / 2, c.plateY, plate, th, i.url) +
    (hasLabel ? pill(cx, c.plateY + plate - 17 + c.pillH / 2, c.pillH, i.label, th, 420) : "") +
    steps +
    (b.footer.trim() ? txt(cx, c.footY, b.footer.trim(), { size: c.steps ? 24 : 26, fill: th.ink, ls: 1, opacity: 0.85 }) : "") +
    (b.showPoweredBy ? txt(cx, c.powY, "POWERED BY ZYON HOLOMENU", { size: c.steps ? 17 : 19, fill: th.muted, ls: 4, opacity: 0.8 }) : "");
  return frame({ W, H: c.H, upm: c.upm, shape: "rect", radius: 0, sticker: false, printShop: ps, th, uid: i.uid, label: `${i.restaurantName} ${i.label}`.trim(), body });
}

// ---------- public API ----------
export function buildDesign(input: DesignInput): Design {
  const th = resolveTheme(input.branding.themeId, input.branding.accent);
  const ps = input.printShop ?? input.branding.printShop;
  const i: DesignInput = { ...input, restaurantName: input.restaurantName.trim() || "Your Restaurant" };
  switch (input.format) {
    case "round": return roundSticker(i, th, ps);
    case "square": return squareSticker(i, th, ps);
    case "card": return portrait(i, th, ps, CARD);
    default: return portrait(i, th, ps, POSTER);
  }
}

export const isSticker = (f: FormatId) => f === "round" || f === "square";

// How many stickers of `sizeMm` fit on an A4 sheet (8 mm margin, 4 mm gap).
export function sheetLayout(sizeMm: number): { cols: number; rows: number; gap: number } {
  const gap = 4, usableW = 210 - 16, usableH = 297 - 16;
  return {
    cols: Math.max(1, Math.floor((usableW + gap) / (sizeMm + gap))),
    rows: Math.max(1, Math.floor((usableH + gap) / (sizeMm + gap))),
    gap,
  };
}
