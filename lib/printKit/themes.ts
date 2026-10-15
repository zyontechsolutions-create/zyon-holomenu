// Print Kit colour themes. Every theme keeps the QR "plate" light and the QR
// modules dark, so codes stay scannable no matter which brand colour is chosen.

export type Theme = {
  id: string;
  name: string;
  bg: string;      // main background
  bg2: string;     // gradient partner for depth
  ink: string;     // primary text on the background
  muted: string;   // secondary text on the background
  accent: string;  // rules, rings, pills, highlights
  onAccent: string;// text colour placed on top of an accent fill
  plate: string;   // light tile behind the QR code
  qr: string;      // QR module colour (must stay dark)
};

export const THEMES: Theme[] = [
  { id: "ink-gold", name: "Ink & Gold", bg: "#1E1B16", bg2: "#2C2720", ink: "#F5F0E4", muted: "#B9B09B", accent: "#D4A24F", onAccent: "#1E1B16", plate: "#FBF8F1", qr: "#1E1B16" },
  { id: "ivory", name: "Ivory", bg: "#FBF8F1", bg2: "#EFE6D2", ink: "#1E1B16", muted: "#6B6455", accent: "#8C6428", onAccent: "#FBF8F1", plate: "#FFFFFF", qr: "#1E1B16" },
  { id: "midnight", name: "Midnight", bg: "#0E1424", bg2: "#1A2542", ink: "#EAF2FF", muted: "#8FA3C7", accent: "#5CC8FF", onAccent: "#0E1424", plate: "#F6FAFF", qr: "#0E1424" },
  { id: "terracotta", name: "Terracotta", bg: "#B4472A", bg2: "#8F351C", ink: "#FFF3E6", muted: "#F2C9B1", accent: "#FFD58A", onAccent: "#3A1409", plate: "#FFF8EF", qr: "#3A1409" },
  { id: "forest", name: "Forest", bg: "#12301F", bg2: "#0A2014", ink: "#F3EEDC", muted: "#A9BFA9", accent: "#D9C27A", onAccent: "#0A2014", plate: "#FAF7EC", qr: "#0A2014" },
];

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

const HEX = /^#[0-9a-fA-F]{6}$/;

// Applies the owner's custom accent colour (if any) on top of a theme.
// onAccent is recomputed so text on pills always stays readable.
export function resolveTheme(id: string, accent: string): Theme {
  const base = getTheme(id);
  if (!HEX.test(accent)) return base;
  const lum = luminance(accent);
  return { ...base, accent, onAccent: lum > 0.5 ? "#1A1712" : "#FFFFFF" };
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
