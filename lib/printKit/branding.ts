// Per-restaurant branding for the Print Kit. Stored in this browser's
// localStorage (same pattern as auto-print), so it needs no database change.

export type FormatId = "round" | "square" | "card" | "poster";

export type Branding = {
  themeId: string;
  accent: string;        // "" = use the theme's own accent
  logo: string | null;   // data URL (resized on upload)
  tagline: string;       // e.g. "Authentic North Indian Kitchen"
  headline: string;      // e.g. "Scan to Order"
  footer: string;        // e.g. "@emberoak  ·  Wi-Fi: EmberGuest"
  showAr: boolean;       // "View dishes in 3D" line on cards & posters
  showPoweredBy: boolean;// small Zyon HoloMenu credit on cards & posters
  printShop: boolean;    // 3 mm bleed + cut line / crop marks for print shops
};

export const DEFAULT_BRANDING: Branding = {
  themeId: "ink-gold",
  accent: "",
  logo: null,
  tagline: "",
  headline: "Scan to Order",
  footer: "",
  showAr: true,
  showPoweredBy: true,
  printShop: false,
};

const KEY = (rid: string) => `zyon-printkit-${rid}`;

export function loadBranding(rid: string): Branding {
  try {
    const raw = localStorage.getItem(KEY(rid));
    if (!raw) return DEFAULT_BRANDING;
    const p = JSON.parse(raw) as Partial<Branding>;
    return {
      themeId: typeof p.themeId === "string" ? p.themeId : DEFAULT_BRANDING.themeId,
      accent: typeof p.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(p.accent) ? p.accent : "",
      logo: typeof p.logo === "string" && p.logo.indexOf("data:image/") === 0 ? p.logo : null,
      tagline: String(p.tagline ?? "").slice(0, 60),
      headline: String(p.headline ?? DEFAULT_BRANDING.headline).slice(0, 28),
      footer: String(p.footer ?? "").slice(0, 70),
      showAr: p.showAr !== false,
      showPoweredBy: p.showPoweredBy !== false,
      printShop: !!p.printShop,
    };
  } catch {
    return DEFAULT_BRANDING;
  }
}

// Returns false if the browser refused to store it (e.g. logo too large).
export function saveBranding(rid: string, b: Branding): boolean {
  try {
    localStorage.setItem(KEY(rid), JSON.stringify(b));
    return true;
  } catch {
    return false;
  }
}

// Reads an uploaded logo and shrinks it to max 640px so it stays crisp in
// print but light in storage. PNG keeps transparency.
export function fileToLogoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) {
      reject(new Error("Please upload a PNG, JPG, WebP or SVG logo."));
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      reject(new Error("That file is too large. Please use a logo under 6 MB."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 640;
      const w0 = img.naturalWidth || max;
      const h0 = img.naturalHeight || max;
      const k = Math.min(1, max / Math.max(w0, h0));
      const w = Math.max(1, Math.round(w0 * k));
      const h = Math.max(1, Math.round(h0 * k));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("Couldn't read that image.")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that image.")); };
    img.src = url;
  });
}
