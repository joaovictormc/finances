"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, Trash2, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CategoryIcon } from "@/components/ui/category-icon";
import { EmptyState } from "@/components/ui/empty-state";
import { useConfirm } from "@/components/ui/confirm-provider";
import { formatBRL, formatShortDate } from "@/lib/utils";
import type { Transaction } from "@/lib/types";
import { ArrowLeftRight } from "lucide-react";
import { PAYMENT_METHOD_BADGE, type CategorySuggestion } from "@finances/validations";

interface TransactionListProps {
  transactions: Transaction[];
  isLoading: boolean;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onToggleAll: () => void;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
  /** Sugestões de categoria por IA pendentes de confirmação, por id de transação. */
  suggestions?: Map<string, CategorySuggestion>;
  onApplySuggestion?: (transactionId: string, categoryId: string) => void;
  onDismissSuggestion?: (transactionId: string) => void;
}

function SuggestionChip({
  suggestion,
  onApply,
  onDismiss,
}: {
  suggestion: CategorySuggestion;
  onApply: () => void;
  onDismiss: () => void;
}) {
  if (!suggestion.categoryId || suggestion.confidence <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] text-primary">
      Sugestão: {suggestion.categoryName} ({Math.round(suggestion.confidence * 100)}%)
      <button type="button" onClick={onApply} title="Aplicar sugestão" className="hover:text-success">
        <Check size={11} />
      </button>
      <button type="button" onClick={onDismiss} title="Descartar sugestão" className="hover:text-destructive">
        <X size={11} />
      </button>
    </span>
  );
}

type ColumnKey = "date" | "description" | "category" | "account" | "amount";

const DEFAULT_WIDTHS: Record<ColumnKey, number> = {
  date: 90,
  description: 200,
  category: 160,
  account: 140,
  amount: 120,
};

const MIN_WIDTH = 80;
const STORAGE_KEY = "transactions-column-widths";

function loadWidths(): Record<ColumnKey, number> | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return { ...DEFAULT_WIDTHS, ...JSON.parse(stored) };
  } catch {
    return null;
  }
}

function useColumnWidths() {
  const [widths, setWidths] = useState<Record<ColumnKey, number>>(DEFAULT_WIDTHS);

  // só lê localStorage depois da hidratação, pra renderização inicial bater com o servidor
  useEffect(() => {
    const stored = loadWidths();
    if (stored) setWidths(stored);
  }, []);

  const startResize = (key: ColumnKey, startX: number) => {
    const startWidth = widths[key];
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      const next = Math.max(MIN_WIDTH, startWidth + (e.clientX - startX));
      setWidths((prev) => ({ ...prev, [key]: next }));
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = previousUserSelect;
      setWidths((prev) => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
        return prev;
      });
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return { widths, startResize };
}

function pinnedWidth(px: number): React.CSSProperties {
  return { width: px, minWidth: px, maxWidth: px, overflow: "hidden" };
}

function ResizableTh({
  column,
  widths,
  startResize,
  className,
  children,
}: {
  column: ColumnKey;
  widths: Record<ColumnKey, number>;
  startResize: (key: ColumnKey, startX: number) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <th
      className={`relative px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide ${className ?? "text-left"}`}
      style={pinnedWidth(widths[column])}
    >
      {children}
      <span
        onMouseDown={(e) => {
          e.preventDefault();
          startResize(column, e.clientX);
        }}
        className="absolute right-0 top-0 bottom-0 z-10 w-2 cursor-col-resize hover:bg-primary/40"
      />
    </th>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 7 }).map((_, i) => (
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

export function TransactionList({
  transactions,
  isLoading,
  selectedIds,
  onToggleSelected,
  onToggleAll,
  onEdit,
  onDelete,
  suggestions,
  onApplySuggestion,
  onDismissSuggestion,
}: TransactionListProps) {
  const { widths, startResize } = useColumnWidths();
  const td = (column: ColumnKey) => pinnedWidth(widths[column]);
  const allSelected =
    transactions.length > 0 && transactions.every((transaction) => selectedIds.has(transaction.id));

  const confirm = useConfirm();
  const handleDelete = async (id: string) => {
    if (await confirm({ description: "Deletar esta transação?", variant: "destructive", confirmLabel: "Deletar" })) {
      onDelete(id);
    }
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
      <div className="hidden md:block bg-card rounded-2xl border border-border/60 shadow-sm overflow-x-auto">
        <table className="text-sm" style={{ tableLayout: "fixed", minWidth: "100%" }}>
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  aria-label={allSelected ? "Desmarcar página" : "Selecionar página"}
                  disabled={isLoading}
                  className="h-4 w-4 accent-primary"
                />
              </th>
              <ResizableTh column="date" widths={widths} startResize={startResize}>Data</ResizableTh>
              <ResizableTh column="description" widths={widths} startResize={startResize}>Descrição</ResizableTh>
              <ResizableTh column="category" widths={widths} startResize={startResize}>Categoria</ResizableTh>
              <ResizableTh column="account" widths={widths} startResize={startResize}>Conta</ResizableTh>
              <ResizableTh column="amount" widths={widths} startResize={startResize} className="text-right">Valor</ResizableTh>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : transactions.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(t.id)}
                        onChange={() => onToggleSelected(t.id)}
                        aria-label={`Selecionar transação ${t.description}`}
                        className="h-4 w-4 accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap" style={td("date")}>
                      {formatShortDate(t.date)}
                    </td>
                    <td className="px-4 py-3" style={td("description")}>
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-medium text-foreground truncate min-w-0">{t.description}</p>
                        {t.paymentMethod && PAYMENT_METHOD_BADGE[t.paymentMethod] && (
                          <Badge variant="default">{PAYMENT_METHOD_BADGE[t.paymentMethod]}</Badge>
                        )}
                        {t.group && (
                          <Badge variant="default">
                            <Users size={10} /> {t.group.name}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3" style={td("category")}>
                      {t.category ? (
                        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground min-w-0 max-w-full">
                          <CategoryIcon icon={t.category.icon} iconUrl={t.category.iconUrl} color={t.category.color} size="sm" />
                          <span className="truncate">{t.category.name}</span>
                        </span>
                      ) : suggestions?.get(t.id) ? (
                        <SuggestionChip
                          suggestion={suggestions.get(t.id)!}
                          onApply={() => onApplySuggestion?.(t.id, suggestions.get(t.id)!.categoryId!)}
                          onDismiss={() => onDismissSuggestion?.(t.id)}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground truncate" style={td("account")}>{t.account.name}</td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap" style={td("amount")}>
                      <span
                        className={
                          t.type === "income"
                            ? "text-success"
                            : t.type === "expense"
                              ? "text-destructive"
                              : "text-foreground"
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
                <input
                  type="checkbox"
                  checked={selectedIds.has(t.id)}
                  onChange={() => onToggleSelected(t.id)}
                  aria-label={`Selecionar transação ${t.description}`}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                <CategoryIcon
                  icon={t.category?.icon ?? (t.type === "income" ? "💚" : t.type === "expense" ? "💸" : "↔️")}
                  iconUrl={t.category?.iconUrl}
                  color={
                    t.category?.color ??
                    (t.type === "income"
                      ? "var(--color-success)"
                      : t.type === "expense"
                        ? "var(--color-destructive)"
                        : "var(--color-muted-foreground)")
                  }
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t.category?.name ?? "Sem categoria"} · {formatShortDate(t.date)}
                  </p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {t.paymentMethod && PAYMENT_METHOD_BADGE[t.paymentMethod] && (
                      <Badge variant="default">{PAYMENT_METHOD_BADGE[t.paymentMethod]}</Badge>
                    )}
                    {t.group && (
                      <Badge variant="default">
                        <Users size={10} /> {t.group.name}
                      </Badge>
                    )}
                    {!t.category && suggestions?.get(t.id) && (
                      <SuggestionChip
                        suggestion={suggestions.get(t.id)!}
                        onApply={() => onApplySuggestion?.(t.id, suggestions.get(t.id)!.categoryId!)}
                        onDismiss={() => onDismissSuggestion?.(t.id)}
                      />
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`text-sm font-semibold ${
                      t.type === "income" ? "text-success" : t.type === "expense" ? "text-destructive" : "text-foreground"
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
