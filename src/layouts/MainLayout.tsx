import { Outlet } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { MobileHeader } from "@/components/MobileHeader";
import { Sidebar } from "@/components/Sidebar";

export function MainLayout() {
  return (
    <div className="min-h-full bg-ig-bg md:bg-ig-bg">
      <Sidebar />
      <div className="md:pl-[244px]">
        <MobileHeader />
        <main className="mx-auto w-full max-w-[1015px] pb-[60px] md:px-4 md:pb-8">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
