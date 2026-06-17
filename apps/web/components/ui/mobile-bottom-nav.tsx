"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ArrowLeftRight, PiggyBank, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { MoreSheet } from "./more-sheet";

const leftItems = [
  { href: "/overview", label: "Início", icon: LayoutDashboard },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
];

const rightItems = [
  { href: "/budgets", label: "Orçamentos", icon: PiggyBank },
  { href: "/goals", label: "Metas", icon: Target },
];

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof LayoutDashboard; active: boolean }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs font-medium"
    >
      <Icon size={20} className={cn(active ? "text-primary" : "text-muted-foreground")} />
      <span className={cn(active ? "text-primary" : "text-muted-foreground")}>{label}</span>
    </Link>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16 relative">
          {leftItems.map((item) => (
            <NavItem key={item.href} {...item} active={pathname.startsWith(item.href)} />
          ))}

          <div className="flex-1 h-full flex items-center justify-center">
            <button
              onClick={() => setMoreOpen(true)}
              aria-label="Mais opções"
              className="relative -mt-6 w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0"
              style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-highlight))" }}
            >
              <span className="absolute inset-0 -z-10 rounded-full bg-primary/40 blur-lg scale-125" />
              <span className="text-lg relative z-10">◆</span>
            </button>
          </div>

          {rightItems.map((item) => (
            <NavItem key={item.href} {...item} active={pathname.startsWith(item.href)} />
          ))}
        </div>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
