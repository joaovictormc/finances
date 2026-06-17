"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CategoryIcon } from "@/components/ui/category-icon";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL, formatShortDate } from "@/lib/utils";
import type { Transaction } from "@/lib/types";
import { ArrowLeftRight } from "lucide-react";

interface TransactionListProps {
  transactions: Transaction[];
  isLoading: boolean;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-muted animate-pulse rounded" />
        </td>
      ))}
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-border last:border-0">
      <div className="w-10 h-10 rounded-lg bg-muted animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
        <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
      </div>
      <div className="h-5 bg-muted animate-pulse rounded w-20" />
    </div>
  );
}

export function TransactionList({ transactions, isLoading, onEdit, onDelete }: TransactionListProps) {
  const handleDelete = (id: string) => {
    if (window.confirm("Deletar esta transação?")) onDelete(id);
  };

  if (!isLoading && transactions.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm">
        <EmptyState
          icon={ArrowLeftRight}
          title="Nenhuma transação encontrada"
          description="Adicione manualmente ou conecte sua conta bancária via Open Finance"
        />
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Data</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Descrição</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Categoria</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Conta</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : transactions.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatShortDate(t.date)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground truncate max-w-[200px]">{t.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      {t.category ? (
                        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                          <CategoryIcon icon={t.category.icon} iconUrl={t.category.iconUrl} color={t.category.color} size="sm" />
                          {t.category.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{t.account.name}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <span
                        className={
                          t.type === "income"
                            ? "text-success"
                            : t.type === "expense"
                              ? "text-destructive"
                              : "text-primary"
                        }
                      >
                        {t.type === "expense" ? "-" : t.type === "income" ? "+" : ""}
                        {formatBRL(Number(t.amount))}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => onEdit(t)}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                <CategoryIcon
                  icon={t.category?.icon ?? (t.type === "income" ? "💚" : t.type === "expense" ? "💸" : "↔️")}
                  iconUrl={t.category?.iconUrl}
                  color={
                    t.category?.color ??
                    (t.type === "income" ? "#22c55e" : t.type === "expense" ? "#ef4444" : "#6366f1")
                  }
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.category?.name ?? "Sem categoria"} · {formatShortDate(t.date)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`text-sm font-semibold ${
                      t.type === "income" ? "text-success" : t.type === "expense" ? "text-destructive" : "text-primary"
                    }`}
                  >
                    {t.type === "expense" ? "-" : t.type === "income" ? "+" : ""}
                    {formatBRL(Number(t.amount))}
                  </p>
                  <div className="flex gap-1 justify-end mt-1">
                    <button onClick={() => onEdit(t)} className="p-1 text-muted-foreground">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="p-1 text-muted-foreground">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </>
  );
}
