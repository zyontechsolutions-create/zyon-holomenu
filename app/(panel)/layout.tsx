import { Suspense } from "react";
import { RestaurantProvider } from "@/lib/RestaurantContext";
import PanelGate from "@/components/PanelGate";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="panel-shell" />}>
      <RestaurantProvider>
        <PanelGate>{children}</PanelGate>
      </RestaurantProvider>
    </Suspense>
  );
}
