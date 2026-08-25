import Link from "next/link";
import { ProgressRing } from "@/components/ui/progress-ring";
import { formatBRL } from "@/lib/utils";
import type { Goal } from "@/lib/types";

export function GoalsPreview({ goals }: { goals: Goal[] }) {
  const items = goals.filter((g) => !g.isCompleted).slice(0, 4);

  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">Metas de Poupança</h2>
        <Link href="/goals" className="text-xs font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground">
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
                className="rounded-xl bg-muted/60 hover:bg-muted p-3 transition-colors flex items-center gap-3"
              >
                <ProgressRing value={pct} color={g.color} size={44} strokeWidth={4} showLabel />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{g.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBRL(Number(g.currentAmount))}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
