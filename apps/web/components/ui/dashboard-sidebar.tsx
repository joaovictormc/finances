"use client";

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NavLinks } from "@/components/ui/nav-links";
import { UserMenu } from "@/components/ui/user-menu";
import { Logo } from "@/components/ui/logo";
import { useSidebar } from "@/app/providers/sidebar-provider";
import { usePlanAccess } from "@/lib/use-plan-access";

const PLAN_LABELS: Record<string, string> = { free: "Plano Gratuito", pro: "Plano Pro", familia: "Plano Família" };

export function DashboardSidebar() {
  const { collapsed, toggleCollapsed } = useSidebar();
  const { plan, loading } = usePlanAccess();

  return (
    <aside
      className={`hidden lg:flex flex-col border-r border-border/60 bg-card transition-all ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div
        className={`flex h-14 items-center border-b border-border/60 ${
          collapsed ? "justify-center px-1" : "justify-between px-4"
        }`}
      >
        {collapsed ? (
          <div className="group relative flex h-11 w-11 items-center justify-center">
            <Logo
              variant="icon"
              size={28}
              className="transition-[filter,opacity] duration-150 group-hover:opacity-40 group-hover:blur-[2px] group-focus-within:opacity-40 group-focus-within:blur-[2px] motion-reduce:transition-none"
            />
            <button
              type="button"
              onClick={toggleCollapsed}
              title="Expandir menu"
              aria-label="Expandir menu lateral"
              className="absolute inset-0 flex items-center justify-center rounded-lg text-foreground opacity-0 transition-opacity duration-150 hover:bg-background/50 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
            >
              <PanelLeftOpen size={20} />
            </button>
          </div>
        ) : (
          <Logo size={24} className="text-base" />
        )}
        <div className="flex items-center gap-1">
          {!collapsed && <ThemeToggle />}
          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              title="Retrair menu"
              aria-label="Retrair menu lateral"
              className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>
      </div>

      <NavLinks collapsed={collapsed} />

      <div className="mt-auto border-t border-border p-4 space-y-3">
        {!collapsed && !loading && (
          <div>
            <p className="text-xs text-muted-foreground">{PLAN_LABELS[plan]}</p>
            {plan !== "familia" && (
              <Link
                href="/settings/billing"
                className="mt-0.5 block text-xs font-medium text-primary hover:underline"
              >
                {plan === "free" ? "Upgrade de plano →" : "Ver planos →"}
              </Link>
            )}
          </div>
        )}
        <UserMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}
