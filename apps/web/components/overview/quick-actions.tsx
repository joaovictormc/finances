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
// automaticamente ao montar (ver useEffect em cada page.tsx). Um único card
// com 4 botões internos — mesmo padrão "um card por bloco" do resto da
// Visão Geral, em vez de 4 cards soltos competindo entre si.
export function QuickActions() {
  return (
    <div className="h-full flex flex-col justify-center bg-card rounded-2xl border border-border/60 shadow-sm p-4">
      <h2 className="mb-3 font-semibold text-foreground">Atalhos rápidos</h2>
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2.5 rounded-xl p-2.5 hover:bg-accent transition-colors"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon size={16} />
            </span>
            <span className="text-xs font-medium text-foreground leading-tight">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
