import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NavLinks } from "@/components/ui/nav-links";
import { MobileSidebar } from "@/components/ui/mobile-sidebar";
import { ToastProvider } from "@/components/ui/toast-provider";
import { UserMenu } from "@/components/ui/user-menu";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden flex-col lg:flex-row">
        <MobileSidebar />

        {/* Sidebar */}
        <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card">
          <div className="flex h-14 items-center justify-between px-4 border-b border-border">
            <span className="text-base font-bold text-primary tracking-tight">Financeiro</span>
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
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-6">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
