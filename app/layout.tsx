import "./globals.css";

export const metadata = {
  title: "Zyon HoloMenu — Control Panel",
  description: "Manage your HoloMenu restaurant menu, orders, and QR codes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
