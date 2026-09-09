"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, UtensilsCrossed, QrCode, ClipboardList, LogOut, Building2, Bell, Volume2 } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useActiveRestaurant } from "@/lib/useActiveRestaurant";
import { unlockAudioPlayback } from "@/lib/notificationSound";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/waiter-calls", label: "Waiter Calls", icon: Bell },
  { href: "/qr-codes", label: "QR Codes", icon: QrCode },
];

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const { isAdmin, newOrderCount, waiterCallCount } = useActiveRestaurant();

  const restaurantParam = searchParams.get("restaurant");
  const suffix = restaurantParam ? `?restaurant=${restaurantParam}` : "";
  const [soundEnabled, setSoundEnabled] = useState(false);

  function handleEnableSound() {
    unlockAudioPlayback();
    setSoundEnabled(true);
    setTimeout(() => setSoundEnabled(false), 2500);
  }

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
        {isAdmin && (
          <Link href="/admin" className={`panel-link ${pathname === "/admin" ? "active" : ""}`}>
            <Building2 size={16} strokeWidth={1.8} />
            <span>All Restaurants</span>
          </Link>
        )}
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link key={href} href={`${href}${suffix}`} className={`panel-link ${active ? "active" : ""}`}>
              <Icon size={16} strokeWidth={1.8} />
              <span>{label}</span>
              {href === "/orders" && newOrderCount > 0 && (
                <span className="nav-badge">{newOrderCount > 9 ? "9+" : newOrderCount}</span>
              )}
              {href === "/waiter-calls" && waiterCallCount > 0 && (
                <span className="nav-badge">{waiterCallCount > 9 ? "9+" : waiterCallCount}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="panel-foot">
        <button onClick={handleEnableSound} className="panel-link w-full">
          <Volume2 size={16} strokeWidth={1.8} />
          <span>{soundEnabled ? "Sound enabled ✓" : "Enable sound alerts"}</span>
        </button>
        <button onClick={handleLogout} className="panel-link w-full">
          <LogOut size={16} strokeWidth={1.8} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
