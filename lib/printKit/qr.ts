import { createElement } from "react";
// @ts-ignore -- this project has no @types/react-dom; the function exists at runtime
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";

// Turns a URL into a single SVG path (vector, so it prints razor sharp at any
// size) using the qrcode.react library that is already in this project.
// Error-correction level "Q" survives scuffs and sticker wear.

export type QrPath = { cells: number; d: string };

const cache = new Map<string, QrPath>();

export function makeQr(value: string): QrPath {
  const hit = cache.get(value);
  if (hit) return hit;
  const markup = renderToStaticMarkup(
    createElement(QRCodeSVG, { value, size: 256, level: "Q", bgColor: "#FFFFFF", fgColor: "#000000", includeMargin: false })
  );
  const vb = /viewBox="0 0 (\d+) \d+"/.exec(markup);
  const paths: string[] = [];
  const re = /<path[^>]*?\sd="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup)) !== null) paths.push(m[1]);
  // First path is the background square, last one is the dark modules.
  if (!vb || paths.length < 2) throw new Error("QR generation failed");
  const out = { cells: parseInt(vb[1], 10), d: paths[paths.length - 1] };
  if (cache.size > 200) cache.clear();
  cache.set(value, out);
  return out;
}
