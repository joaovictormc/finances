"use client";

import { useEffect, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { AiInsight } from "@/lib/types";

const SEVERITY_STYLES: Record<AiInsight["severity"], string> = {
  success: "border-success/30 bg-success/5",
  warning: "border-warning/30 bg-warning/5",
  critical: "border-destructive/30 bg-destructive/5",
  info: "border-primary/30 bg-primary/5",
};

export function InsightsPanel() {
  const [insights, setInsights] = useState<AiInsight[] | null>(null);

  useEffect(() => {
    api
      .get<AiInsight[]>("/api/ai/insights")
      .then(setInsights)
      .catch(() => setInsights([]));
  }, []);

  const dismiss = async (id: string) => {
    setInsights((prev) => prev?.filter((i) => i.id !== id) ?? null);
    try {
      await api.patch(`/api/ai/insights/${id}/dismiss`, {});
    } catch {
      // mantém dispensado no client mesmo se a chamada falhar — não é crítico
    }
  };

  if (insights === null) return null;
  if (insights.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb size={18} className="text-muted-foreground" />
        <h2 className="font-semibold text-foreground">Insights</h2>
      </div>
      <div className="space-y-2">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={cn("flex items-start gap-3 rounded-xl border p-3", SEVERITY_STYLES[insight.severity])}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{insight.title}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{insight.body}</p>
            </div>
            <button
              onClick={() => dismiss(insight.id)}
              className="text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Dispensar"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
