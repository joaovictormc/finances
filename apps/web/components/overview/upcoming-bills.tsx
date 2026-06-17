import Link from "next/link";
import { cn, formatBRL, formatDate } from "@/lib/utils";
import type { RecurringBill } from "@/lib/types";

export function UpcomingBills({ bills }: { bills: RecurringBill[] }) {
  const items = bills
    .filter((b) => b.isActive && b.nextDueDate)
    .slice()
    .sort((a, b) => new Date(a.nextDueDate!).getTime() - new Date(b.nextDueDate!).getTime())
    .slice(0, 4);

  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-foreground">Próximas Contas</h2>
        <Link href="/bills" className="text-xs font-medium text-primary hover:underline">
          Ver tudo
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Nenhuma conta a vencer.</p>
      ) : (
        <div className="space-y-2 mt-3">
          {items.map((b, i) => {
            const days = Math.ceil((new Date(b.nextDueDate!).getTime() - Date.now()) / 86400000);
            const featured = i === 0;
            return (
              <div
                key={b.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5",
                  featured ? "bg-primary text-primary-foreground" : "bg-muted/60"
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-sm shrink-0">
                  {b.category?.icon ?? "📄"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium truncate", featured ? "text-primary-foreground" : "text-foreground")}>{b.name}</p>
                  <p className={cn("text-xs", featured ? "text-primary-foreground/75" : "text-muted-foreground")}>
                    {days < 0 ? `Vencida há ${Math.abs(days)}d` : days === 0 ? "Vence hoje" : `${formatDate(b.nextDueDate!)} · ${days}d`}
                  </p>
                </div>
                {b.expectedAmount && (
                  <p className={cn("text-sm font-semibold shrink-0", featured ? "text-primary-foreground" : "text-foreground")}>
                    {formatBRL(Number(b.expectedAmount))}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
