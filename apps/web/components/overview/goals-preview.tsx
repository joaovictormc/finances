import Link from "next/link";
import { CategoryIcon } from "@/components/ui/category-icon";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatBRL } from "@/lib/utils";
import type { Goal } from "@/lib/types";

export function GoalsPreview({ goals }: { goals: Goal[] }) {
  const items = goals.filter((g) => !g.isCompleted).slice(0, 4);

  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">Metas de Poupança</h2>
        <Link href="/goals" className="text-xs font-medium text-primary hover:underline">
          Ver tudo
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma meta ativa por aqui.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((g) => {
            const pct = Number(g.targetAmount) > 0 ? Number(g.currentAmount) / Number(g.targetAmount) : 0;
            return (
              <Link
                key={g.id}
                href="/goals"
                className="rounded-xl bg-muted/60 hover:bg-muted p-3 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <CategoryIcon icon={g.icon} iconUrl={g.iconUrl} color={g.color} size="sm" />
                  <p className="text-sm font-medium text-foreground truncate">{g.name}</p>
                </div>
                <p className="text-xs text-muted-foreground mb-1.5">{formatBRL(Number(g.currentAmount))}</p>
                <ProgressBar value={pct} color={g.color} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
