import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Zyon HoloMenu",
    short_name: "HoloMenu",
    description: "Manage your restaurant's menu, orders, and QR codes.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F5F0E4",
    theme_color: "#1E1B16",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
