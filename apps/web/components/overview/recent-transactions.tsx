import Link from "next/link";
import { CategoryIcon } from "@/components/ui/category-icon";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatShortDate } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-foreground">Movimentações Recentes</h2>
        <Link href="/transactions" className="text-xs font-medium text-primary hover:underline">
          Ver tudo
        </Link>
      </div>

      {transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Nenhuma transação ainda.</p>
      ) : (
        <div className="divide-y divide-border/60">
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-3 first:pt-2 last:pb-0">
              <CategoryIcon
                icon={t.category?.icon ?? (t.type === "income" ? "💚" : t.type === "expense" ? "💸" : "↔️")}
                iconUrl={t.category?.iconUrl}
                color={t.category?.color ?? (t.type === "income" ? "#22c55e" : t.type === "expense" ? "#ef4444" : "#6366f1")}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                  {t.paymentMethod === "credit" && <Badge variant="default">💳 Crédito</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.category?.name ?? "Sem categoria"} · {formatShortDate(t.date)}
                </p>
              </div>
              <p
                className={`text-sm font-semibold shrink-0 ${
                  t.type === "income" ? "text-success" : t.type === "expense" ? "text-destructive" : "text-primary"
                }`}
              >
                {t.type === "expense" ? "-" : t.type === "income" ? "+" : ""}
                {formatBRL(Number(t.amount))}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
