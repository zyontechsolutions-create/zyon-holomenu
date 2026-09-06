import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import { RestaurantProvider } from "@/lib/RestaurantContext";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="panel-shell" />}>
      <RestaurantProvider>
        <div className="panel-shell">
          <Sidebar />
          <main className="panel-main">{children}</main>
        </div>
      </RestaurantProvider>
    </Suspense>
  );
}
