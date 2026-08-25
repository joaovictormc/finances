"use client";

import Link from "next/link";
import { ArrowLeftRight, PiggyBank, Target, FileText } from "lucide-react";

const ACTIONS = [
  { href: "/transactions?new=1", icon: ArrowLeftRight, label: "Transação" },
  { href: "/budgets?new=1", icon: PiggyBank, label: "Orçamento" },
  { href: "/goals?new=1", icon: Target, label: "Meta" },
  { href: "/bills?new=1", icon: FileText, label: "Conta a pagar" },
] as const;

// Atalhos de criação rápida (elemento emprestado do kit
// finance-application-for-sketch, ver docs/ajustes-pos-teste.md). Cada rota
// de destino lê `?new=1` via useSearchParams e abre o Modal de criação
// automaticamente ao montar (ver useEffect em cada page.tsx).
export function QuickActions() {
  return (
    <div className="mb-6 grid grid-cols-4 gap-3">
      {ACTIONS.map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center gap-2 rounded-2xl bg-card border border-border/60 shadow-sm p-4 text-center hover:shadow-md hover:border-border transition-all"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon size={18} />
          </span>
          <span className="text-xs font-medium text-foreground leading-tight">{label}</span>
        </Link>
      ))}
    </div>
  );
}
