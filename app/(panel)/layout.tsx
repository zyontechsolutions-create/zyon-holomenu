import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="panel-shell">
      <Suspense fallback={<aside className="panel-sidebar" />}>
        <Sidebar />
      </Suspense>
      <main className="panel-main">{children}</main>
    </div>
  );
}
