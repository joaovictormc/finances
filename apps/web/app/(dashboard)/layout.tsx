import { MobileSidebar } from "@/components/ui/mobile-sidebar";
import { MobileBottomNav } from "@/components/ui/mobile-bottom-nav";
import { ToastProvider } from "@/components/ui/toast-provider";
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { DashboardSidebar } from "@/components/ui/dashboard-sidebar";
import { SidebarProvider } from "@/app/providers/sidebar-provider";
import { PlanAccessProvider } from "@/lib/use-plan-access";
import { PointsProvider } from "@/components/ui/points-badge";
import { NotificationsProvider } from "@/components/ui/notification-bell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        {/* Dados que as duas sidebars mostram (plano, pontos, notificações) são
            buscados uma vez aqui — as duas ficam montadas, o CSS só esconde uma. */}
        <PlanAccessProvider>
          <PointsProvider>
            <NotificationsProvider>
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
            </NotificationsProvider>
          </PointsProvider>
        </PlanAccessProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
