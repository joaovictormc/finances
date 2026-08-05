"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";

type AiSettings = {
  textModel: string;
  audioModel: string;
  expenseParsingEnabled: boolean;
  monthlyInsightsEnabled: boolean;
  nlQueryEnabled: boolean;
  categorySuggestionEnabled: boolean;
  monthlyTokenLimit: number | null;
};

type AiUsage = {
  byFeature: { feature: string; _count: number; _sum: { promptTokens: number | null; completionTokens: number | null } }[];
  last1d: number;
  last7d: number;
  last30d: number;
  monthlyTokenUsage: number;
};

const FEATURE_LABELS: Record<string, string> = {
  expense_parsing: "Parsing de despesas (bot)",
  monthly_insight: "Insight mensal",
  nl_query: "Consultas em linguagem natural",
  voice_transcription: "Transcrição de voz",
  category_suggestion: "Sugestão de categoria",
};

export default function AdminAiPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [s, u] = await Promise.all([
        api.get<AiSettings>("/api/admin/ai/settings"),
        api.get<AiUsage>("/api/admin/ai/usage"),
      ]);
      setSettings(s);
      setUsage(u);
    } catch {
      toast({ title: "Erro ao carregar configurações de IA", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await api.patch<AiSettings>("/api/admin/ai/settings", settings);
      setSettings(updated);
      toast({ title: "Configurações salvas", variant: "success" });
    } catch {
      toast({ title: "Erro ao salvar configurações", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !settings) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Modelos de IA</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure o modelo Groq ativo e features de IA</p>
      </div>

      <div className="space-y-6">
        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-4">Modelos</h2>
          <div className="space-y-4">
            <Input
              label="Modelo de texto (Groq)"
              value={settings.textModel}
              onChange={(e) => setSettings({ ...settings, textModel: e.target.value })}
            />
            <Input
              label="Modelo de áudio (Groq)"
              value={settings.audioModel}
              onChange={(e) => setSettings({ ...settings, audioModel: e.target.value })}
            />
          </div>
        </section>

        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1">Features</h2>
          <p className="text-sm text-muted-foreground mb-4">Ative ou desative funcionalidades de IA globalmente</p>
          <div className="space-y-3">
            <ToggleRow
              label="Parsing de despesas pelo bot"
              description="Interpretar mensagens de texto/voz do bot como gastos/receitas"
              enabled={settings.expenseParsingEnabled}
              onChange={(v) => setSettings({ ...settings, expenseParsingEnabled: v })}
            />
            <ToggleRow
              label="Insights mensais"
              description="Geração automática do resumo mensal por IA"
              enabled={settings.monthlyInsightsEnabled}
              onChange={(v) => setSettings({ ...settings, monthlyInsightsEnabled: v })}
            />
            <ToggleRow
              label="Consultas em linguagem natural"
              description="Endpoint /api/ai/query usado na Visão Geral"
              enabled={settings.nlQueryEnabled}
              onChange={(v) => setSettings({ ...settings, nlQueryEnabled: v })}
            />
            <ToggleRow
              label="Sugestão de categoria"
              description="Sugere categoria para transações sem categoria — não aplica automático"
              enabled={settings.categorySuggestionEnabled}
              onChange={(v) => setSettings({ ...settings, categorySuggestionEnabled: v })}
            />
          </div>
        </section>

        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1">Limite de uso</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Tokens (prompt + resposta) permitidos por mês, somando todas as features. Deixe em branco para ilimitado.
          </p>
          <Input
            type="number"
            min={1}
            label="Limite mensal de tokens"
            placeholder="Ilimitado"
            value={settings.monthlyTokenLimit ?? ""}
            onChange={(e) =>
              setSettings({
                ...settings,
                monthlyTokenLimit: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </section>

        <Button onClick={handleSave} loading={saving}>Salvar configurações</Button>

        {usage && (
          <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
            <h2 className="text-base font-semibold mb-4">Uso de IA</h2>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <UsageCard label="Últimas 24h" value={usage.last1d} />
              <UsageCard label="Últimos 7 dias" value={usage.last7d} />
              <UsageCard label="Últimos 30 dias" value={usage.last30d} />
            </div>

            {settings.monthlyTokenLimit != null && (
              <div className="mb-5">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Uso de tokens neste mês</span>
                  <span>{usage.monthlyTokenUsage} / {settings.monthlyTokenLimit}</span>
                </div>
                <ProgressBar value={usage.monthlyTokenUsage / settings.monthlyTokenLimit} />
              </div>
            )}
            <div className="space-y-2">
              {usage.byFeature.map((f) => (
                <div key={f.feature} className="flex items-center justify-between text-sm border-b border-border/40 py-2 last:border-0">
                  <span className="text-foreground">{FEATURE_LABELS[f.feature] ?? f.feature}</span>
                  <span className="text-muted-foreground text-xs">
                    {f._count} chamadas · {(f._sum.promptTokens ?? 0) + (f._sum.completionTokens ?? 0)} tokens
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function UsageCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 p-4 text-center">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-border last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          enabled ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
