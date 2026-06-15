"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu, X,
  LayoutDashboard, ArrowLeftRight, PiggyBank,
  Target, FileText, CreditCard, Settings, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { href: "/overview", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/budgets", label: "Orçamentos", icon: PiggyBank },
  { href: "/goals", label: "Metas", icon: Target },
  { href: "/bills", label: "Contas a Pagar", icon: FileText },
  { href: "/accounts", label: "Contas Bancárias", icon: CreditCard },
  { href: "/bot", label: "Integração Bot", icon: Bot },
  { href: "/settings", label: "Configurações", icon: Settings },
];

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const currentPage = navItems.find((item) => pathname.startsWith(item.href));

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden flex h-14 items-center justify-between px-4 border-b border-border bg-card">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-accent transition-colors"
        >
          <Menu size={20} />
        </button>
        <span className="text-sm font-semibold text-primary">
          {currentPage?.label ?? "Financeiro"}
        </span>
        <ThemeToggle />
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-out panel */}
      <div
        className={cn(
          "lg:hidden fixed left-0 top-0 bottom-0 z-50 w-64 bg-card border-r border-border flex flex-col",
          "transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between px-4 border-b border-border">
          <span className="text-base font-bold text-primary">Financeiro</span>
          <button
            onClick={() => setOpen(false)}
            className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-accent transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 p-3 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground">Plano Gratuito</p>
        </div>
      </div>
    </>
  );
}
