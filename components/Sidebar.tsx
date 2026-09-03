"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, UtensilsCrossed, QrCode, ClipboardList, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/qr-codes", label: "QR Codes", icon: QrCode },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="panel-sidebar">
      <div className="panel-brand">
        <div className="corner-sm" aria-hidden="true" />
        <p>ZYON <span>HOLOMENU</span></p>
      </div>
      <nav className="panel-nav">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link key={href} href={href} className={`panel-link ${active ? "active" : ""}`}>
              <Icon size={16} strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="panel-foot">
        <button onClick={handleLogout} className="panel-link w-full">
          <LogOut size={16} strokeWidth={1.8} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
