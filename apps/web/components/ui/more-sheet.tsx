"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, CreditCard, Bot, Settings, Sparkles, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

// A grade é de 2 colunas: manter a contagem par evita um item órfão na última
// linha. Recompensas também fechava uma lacuna — não havia entrada para ela em
// nenhuma navegação mobile.
const moreItems = [
  { href: "/bills", label: "Contas a Pagar", icon: FileText },
  { href: "/accounts", label: "Contas Bancárias", icon: CreditCard },
  { href: "/groups", label: "Família", icon: Users },
  { href: "/assistant", label: "Assistente", icon: Bot },
  { href: "/rewards", label: "Recompensas", icon: Sparkles },
  { href: "/settings", label: "Configurações", icon: Settings },
];

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}

export function MoreSheet({ open, onClose }: MoreSheetProps) {
  const pathname = usePathname();

  if (!open) return null;

  return (
    <>
      <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-border bg-card p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-foreground">Mais opções</span>
          <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:bg-accent transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {moreItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
                )}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
