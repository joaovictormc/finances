import { MobileSidebar } from "@/components/ui/mobile-sidebar";
import { MobileBottomNav } from "@/components/ui/mobile-bottom-nav";
import { ToastProvider } from "@/components/ui/toast-provider";
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { DashboardSidebar } from "@/components/ui/dashboard-sidebar";
import { SidebarProvider } from "@/app/providers/sidebar-provider";
import { QueryProvider } from "@/app/providers/query-provider";
import { NotificationsProvider } from "@/components/ui/notification-bell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        {/* As duas sidebars ficam montadas (o CSS só esconde uma): plano e
            pontos vêm do cache do React Query, notificações de um provider só. */}
        <QueryProvider>
          <NotificationsProvider>
              <SidebarProvider>
                <div className="flex h-screen overflow-hidden flex-col lg:flex-row">
                  <MobileSidebar />

                  <DashboardSidebar />

                  {/* Main content */}
                  {/* Espaço da barra inferior + a linha de gesto do iPhone. */}
                  <main className="flex-1 overflow-auto pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
                    <div className="max-w-7xl mx-auto p-6">{children}</div>
                  </main>

                  <MobileBottomNav />
                </div>
              </SidebarProvider>
          </NotificationsProvider>
        </QueryProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
