import { MobileSidebar } from "@/components/ui/mobile-sidebar";
import { MobileBottomNav } from "@/components/ui/mobile-bottom-nav";
import { ToastProvider } from "@/components/ui/toast-provider";
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { DashboardSidebar } from "@/components/ui/dashboard-sidebar";
import { SidebarProvider } from "@/app/providers/sidebar-provider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <SidebarProvider>
          <div className="flex h-screen overflow-hidden flex-col lg:flex-row">
            <MobileSidebar />

            <DashboardSidebar />

            {/* Main content */}
            <main className="flex-1 overflow-auto pb-20 lg:pb-0">
              <div className="max-w-7xl mx-auto p-6">{children}</div>
            </main>

            <MobileBottomNav />
          </div>
        </SidebarProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
