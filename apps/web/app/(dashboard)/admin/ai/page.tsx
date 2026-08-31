"use client";

import { useCallback, useEffect, useState } from "react";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";

type AiSettings = {
  textModel: string;
  visionModel: string;
  assistantModel: string;
  assistantEnabled: boolean;
  monthlyInsightsEnabled: boolean;
  nlQueryEnabled: boolean;
  categorySuggestionEnabled: boolean;
  receiptScanEnabled: boolean;
  monthlyTokenLimit: number | null;
  monthlyBudgetUsd: number | null;
};

type UsageTotals = {
  calls: number;
  tokens: number;
  costUsd: number;
  hasUnpricedUsage: boolean;
};

type UsageBreakdown = UsageTotals & { id: string; costNote?: string | null };

type AiUsage = {
  month: UsageTotals & {
    elapsedRatio: number;
    projectedCostUsd: number;
    projectedTokens: number;
    byFeature: UsageBreakdown[];
    byModel: UsageBreakdown[];
  };
  windows: { last1d: UsageTotals; last7d: UsageTotals; last30d: UsageTotals };
  allTime: UsageTotals;
  monthlyTokenLimit: number | null;
  monthlyBudgetUsd: number | null;
};

const numberFormat = new Intl.NumberFormat("pt-BR");

/** Gasto de IA é centavo de dólar: com 2 casas quase tudo viraria "US$ 0,00". */
function formatUsd(value: number) {
  return `US$ ${value >= 0.01 ? value.toFixed(2) : value.toFixed(4)}`;
}

// `expense_parsing` e `voice_transcription` saíram junto com o bot, mas os
// rótulos ficam: o AiUsageLog guarda linhas históricas com esses valores e o
// medidor de consumo precisa continuar nomeando-as.
const FEATURE_LABELS: Record<string, string> = {
  expense_parsing: "Parsing de despesas (bot, removido)",
  voice_transcription: "Transcrição de voz (bot, removido)",
  monthly_insight: "Insight mensal",
  nl_query: "Consultas em linguagem natural",
  category_suggestion: "Sugestão de categoria",
  receipt_scan: "Leitura de cupom fiscal",
  assistant: "Assistente de IA",
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
    <div className="max-w-3xl">
      <BackButton href="/admin" label="Administração" />
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
              label="Modelo de visão (Groq)"
              value={settings.visionModel}
              onChange={(e) => setSettings({ ...settings, visionModel: e.target.value })}
            />
            <Input
              label="Modelo do assistente (Groq)"
              value={settings.assistantModel}
              onChange={(e) => setSettings({ ...settings, assistantModel: e.target.value })}
            />
          </div>
        </section>

        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1">Features</h2>
          <p className="text-sm text-muted-foreground mb-4">Ative ou desative funcionalidades de IA globalmente</p>
          <div className="space-y-3">
            <ToggleRow
              label="Assistente de IA"
              description="Chat com histórico e agentes personalizados (planos Pro e Família)"
              enabled={settings.assistantEnabled}
              onChange={(v) => setSettings({ ...settings, assistantEnabled: v })}
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
            <ToggleRow
              label="Leitura de cupom fiscal"
              description="Escaneamento de cupons/NF-e por foto no mobile (planos Pro e Família)"
              enabled={settings.receiptScanEnabled}
              onChange={(v) => setSettings({ ...settings, receiptScanEnabled: v })}
            />
          </div>
        </section>

        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1">Limite de uso</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Tokens (prompt + resposta) permitidos por mês, somando todas as features. Deixe em branco para ilimitado.
          </p>
          <div className="space-y-4">
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
            <Input
              type="number"
              min={0}
              step="0.01"
              label="Orçamento mensal (US$)"
              placeholder="Sem orçamento"
              value={settings.monthlyBudgetUsd ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  monthlyBudgetUsd: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              O orçamento é só referência do medidor abaixo — quem interrompe as chamadas ao atingir
              o teto é o limite de tokens.
            </p>
          </div>
        </section>

        <Button onClick={handleSave} loading={saving}>Salvar configurações</Button>

        {usage && (
          <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
            <h2 className="text-base font-semibold mb-1">Consumo de IA</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Todas as features, todos os usuários. Custo estimado em dólar a partir da tabela de
              preços da Groq.
            </p>

            <div className="rounded-xl border border-border/60 p-5 mb-5">
              <p className="text-3xl font-bold text-foreground">{formatUsd(usage.month.costUsd)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                neste mês ({Math.round(usage.month.elapsedRatio * 100)}% decorrido) · no ritmo atual,
                fecha em {formatUsd(usage.month.projectedCostUsd)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {numberFormat.format(usage.month.tokens)} tokens em {usage.month.calls} chamadas
              </p>
              {usage.month.hasUnpricedUsage && (
                <p className="text-xs text-warning mt-2">
                  Há chamadas de modelos sem preço estimável — o valor acima é um piso.
                </p>
              )}
            </div>

            {usage.monthlyTokenLimit == null && usage.monthlyBudgetUsd == null ? (
              <p className="text-xs text-muted-foreground mb-5">
                Defina um limite de tokens ou um orçamento acima para acompanhar o consumo em barra.
              </p>
            ) : (
              <div className="space-y-4 mb-5">
                {usage.monthlyTokenLimit != null && (
                  <Meter
                    label="Tokens no mês"
                    current={numberFormat.format(usage.month.tokens)}
                    total={numberFormat.format(usage.monthlyTokenLimit)}
                    value={usage.month.tokens / usage.monthlyTokenLimit}
                  />
                )}
                {usage.monthlyBudgetUsd != null && (
                  <Meter
                    label="Orçamento do mês"
                    current={formatUsd(usage.month.costUsd)}
                    total={formatUsd(usage.monthlyBudgetUsd)}
                    value={usage.month.costUsd / usage.monthlyBudgetUsd}
                  />
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 mb-6">
              <UsageCard label="Últimas 24h" totals={usage.windows.last1d} />
              <UsageCard label="Últimos 7 dias" totals={usage.windows.last7d} />
              <UsageCard label="Últimos 30 dias" totals={usage.windows.last30d} />
            </div>

            <UsageBreakdownList
              title="Por modelo (mês)"
              rows={usage.month.byModel}
              labelFor={(id) => id}
            />
            <UsageBreakdownList
              title="Por feature (mês)"
              rows={usage.month.byFeature}
              labelFor={(id) => FEATURE_LABELS[id] ?? id}
            />

            <p className="text-xs text-muted-foreground mt-6 pt-4 border-t border-border/40">
              Desde o início: {usage.allTime.calls} chamadas ·{" "}
              {numberFormat.format(usage.allTime.tokens)} tokens ·{" "}
              {formatUsd(usage.allTime.costUsd)}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function Meter({
  label,
  current,
  total,
  value,
}: {
  label: string;
  current: string;
  total: string;
  value: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span>{label}</span>
        <span>
          {current} / {total}
        </span>
      </div>
      <ProgressBar value={value} />
    </div>
  );
}

function UsageCard({ label, totals }: { label: string; totals: UsageTotals }) {
  return (
    <div className="rounded-xl border border-border/60 p-4 text-center">
      <p className="text-2xl font-bold text-foreground">{formatUsd(totals.costUsd)}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
      <p className="text-xs text-muted-foreground mt-2">
        {totals.calls} chamadas · {numberFormat.format(totals.tokens)} tokens
      </p>
    </div>
  );
}

function UsageBreakdownList({
  title,
  rows,
  labelFor,
}: {
  title: string;
  rows: UsageBreakdown[];
  labelFor: (id: string) => string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="mb-6 last:mb-0">
      <h3 className="text-sm font-medium text-foreground mb-2">{title}</h3>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-3 text-sm border-b border-border/40 py-2 last:border-0"
          >
            <span className="text-foreground truncate">{labelFor(row.id)}</span>
            <span className="text-muted-foreground text-xs shrink-0 text-right">
              {row.calls} chamadas · {numberFormat.format(row.tokens)} tokens ·{" "}
              {row.costNote ? row.costNote : formatUsd(row.costUsd)}
            </span>
          </div>
        ))}
      </div>
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
