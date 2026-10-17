"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Target,
  FileText,
  CreditCard,
  Settings,
  Bot,
  Users,
  ShieldCheck,
  Lock,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { useModuleLinks } from "@/lib/use-plan-access";
import { useHydrated } from "@/lib/use-hydrated";

const baseNavItems = [
  { href: "/overview", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/budgets", label: "Orçamentos", icon: PiggyBank },
  { href: "/goals", label: "Metas", icon: Target },
  { href: "/bills", label: "Contas a Pagar", icon: FileText },
  { href: "/accounts", label: "Contas Bancárias", icon: CreditCard },
  { href: "/rewards", label: "Recompensas", icon: Sparkles },
];

const groupsItem = { href: "/groups", label: "Família", icon: Users };
const assistantItem = { href: "/assistant", label: "Assistente", icon: Bot };
const settingsItem = { href: "/settings", label: "Configurações", icon: Settings };

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

export function NavLinks({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { isLocked, hrefFor } = useModuleLinks();
  // A sessão só existe no navegador: o item Admin entra depois da hidratação.
  const hydrated = useHydrated();
  const isAdmin = hydrated && (session?.user as { role?: string } | undefined)?.role === "admin";

  const items: NavItem[] = [
    ...baseNavItems,
    groupsItem,
    assistantItem,
    settingsItem,
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: ShieldCheck }] : []),
  ];

  return (
    <nav className="flex-1 min-h-0 overflow-y-auto space-y-1 p-3">
      {items.map((item) => {
        const locked = isLocked(item.href);
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            // Bloqueado leva direto à tela de planos, que diz qual plano libera.
            href={hrefFor(item.href)}
            title={collapsed ? (locked ? `${item.label} (ver planos)` : item.label) : undefined}
            aria-label={locked ? `${item.label}, bloqueado no seu plano: ver planos` : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              collapsed && "justify-center",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon size={16} className="shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">{item.label}</span>
                {locked && <Lock size={12} className="shrink-0 opacity-60" />}
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
