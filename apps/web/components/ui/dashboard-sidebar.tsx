"use client";

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NavLinks } from "@/components/ui/nav-links";
import { UserMenu } from "@/components/ui/user-menu";
import { Logo } from "@/components/ui/logo";
import { useSidebar } from "@/app/providers/sidebar-provider";

export function DashboardSidebar() {
  const { collapsed, toggleCollapsed } = useSidebar();

  return (
    <aside
      className={`hidden lg:flex flex-col border-r border-border/60 bg-card transition-all ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="flex h-14 items-center justify-between px-4 border-b border-border/60">
        {!collapsed && <Logo size={24} className="text-base" />}
        <div className="flex items-center gap-1">
          {!collapsed && <ThemeToggle />}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Expandir menu" : "Retrair menu"}
            className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
      </div>

      <NavLinks collapsed={collapsed} />

      <div className="mt-auto border-t border-border p-4 space-y-3">
        {!collapsed && (
          <div>
            <p className="text-xs text-muted-foreground">Plano Gratuito</p>
            <Link
              href="/upgrade"
              className="mt-0.5 block text-xs font-medium text-primary hover:underline"
            >
              Upgrade para Pro →
            </Link>
          </div>
        )}
        <UserMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}
