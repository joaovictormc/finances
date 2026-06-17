import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NavLinks } from "@/components/ui/nav-links";
import { MobileSidebar } from "@/components/ui/mobile-sidebar";
import { MobileBottomNav } from "@/components/ui/mobile-bottom-nav";
import { ToastProvider } from "@/components/ui/toast-provider";
import { UserMenu } from "@/components/ui/user-menu";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden flex-col lg:flex-row">
        <MobileSidebar />

        {/* Sidebar */}
        <aside className="hidden lg:flex w-60 flex-col border-r border-border/60 bg-card">
          <div className="flex h-14 items-center justify-between px-4 border-b border-border/60">
            <span className="flex items-center gap-2 text-base font-bold text-foreground tracking-tight">
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm text-white shrink-0"
                style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-highlight))" }}
              >
                ◆
              </span>
              Financeiro
            </span>
            <ThemeToggle />
          </div>

          <NavLinks />

          <div className="mt-auto border-t border-border p-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Plano Gratuito</p>
              <Link
                href="/upgrade"
                className="mt-0.5 block text-xs font-medium text-primary hover:underline"
              >
                Upgrade para Pro →
              </Link>
            </div>
            <UserMenu />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto pb-20 lg:pb-0">
          <div className="max-w-7xl mx-auto p-6">{children}</div>
        </main>

        <MobileBottomNav />
      </div>
    </ToastProvider>
  );
}
