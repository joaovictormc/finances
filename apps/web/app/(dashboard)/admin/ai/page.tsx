"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type ProviderId = "groq" | "anthropic" | "ollama";

type ModelInfo = { id: string; label: string; tier: "free" | "paid" };

type ProviderStatus = {
  id: ProviderId;
  name: string;
  keyUrl: string;
  pricingNote: string;
  /** De onde vem a chave em uso: painel, .env ou nenhuma. */
  source: "admin" | "env" | null;
  maskedKey: string | null;
  verifiedAt: string | null;
  lastError: string | null;
  models: ModelInfo[];
};

type Slot = "text" | "vision" | "assistant" | "changelog";

const SLOTS: { id: Slot; label: string; description: string }[] = [
  { id: "text", label: "Texto", description: "Insights mensais, perguntas na Visão Geral e sugestão de categoria" },
  { id: "vision", label: "Imagem", description: "Leitura de cupom fiscal por foto. Escolha um modelo que aceite imagem." },
  { id: "assistant", label: "Assistente", description: "Conversa com histórico e consulta aos dados (usa ferramentas)" },
  {
    id: "changelog",
    label: "Novidades (commits)",
    description: "Lê os commits do GitHub e escreve o rascunho de Novidades para você revisar em Admin › Novidades",
  },
];

type AiSettings = {
  textProvider: ProviderId;
  visionProvider: ProviderId;
  assistantProvider: ProviderId;
  changelogProvider: ProviderId;
  changelogModel: string;
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
  changelog_draft: "Rascunho de novidades",
};

export default function AdminAiPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [s, p, u] = await Promise.all([
        api.get<AiSettings>("/api/admin/ai/settings"),
        api.get<ProviderStatus[]>("/api/admin/ai/providers"),
        api.get<AiUsage>("/api/admin/ai/usage"),
      ]);
      setSettings(s);
      setProviders(p);
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
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erro ao salvar configurações", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  const updateProvider = (status: ProviderStatus) =>
    setProviders((list) => list.map((p) => (p.id === status.id ? status : p)));

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
        <p className="text-muted-foreground text-sm mt-1">Provedores, modelo de cada função e features de IA</p>
      </div>

      <div className="space-y-6">
        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1">Provedores</h2>
          <p className="text-sm text-muted-foreground mb-4">
            A chave é validada antes de salvar e fica guardada criptografada. Sem chave no painel, vale a do .env.
          </p>
          <div className="space-y-4">
            {providers.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} onChange={updateProvider} />
            ))}
          </div>
        </section>

        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1">Modelo de cada função</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Só aparecem provedores com chave. Na lista, os modelos gratuitos vêm primeiro.
          </p>
          <div className="space-y-5">
            {SLOTS.map((slot) => (
              <SlotPicker
                key={slot.id}
                slot={slot}
                providers={providers}
                provider={settings[`${slot.id}Provider`]}
                model={settings[`${slot.id}Model`]}
                onChange={(provider, model) =>
                  setSettings({ ...settings, [`${slot.id}Provider`]: provider, [`${slot.id}Model`]: model })
                }
                onRefreshed={updateProvider}
              />
            ))}
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
              preços cadastrada; modelo sem preço aparece como &quot;preço não cadastrado&quot;.
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

const PROVIDER_STATUS: Record<NonNullable<ProviderStatus["source"]>, string> = {
  admin: "chave do painel",
  env: "chave do .env",
};

function ProviderCard({ provider, onChange }: { provider: ProviderStatus; onChange: (s: ProviderStatus) => void }) {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<"save" | "refresh" | "remove" | null>(null);

  async function run(kind: "save" | "refresh" | "remove", action: () => Promise<ProviderStatus & { warning?: string }>, success: string) {
    setBusy(kind);
    try {
      const status = await action();
      onChange(status);
      toast({ title: status.warning ?? success, variant: status.warning ? "error" : "success" });
      if (kind === "save") setApiKey("");
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Não foi possível falar com o provedor", variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  const free = provider.models.filter((m) => m.tier === "free").length;

  return (
    <div className="rounded-xl border border-border/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="font-medium text-foreground">{provider.name}</p>
          {provider.source ? (
            <Badge variant={provider.lastError ? "warning" : "success"}>
              {provider.lastError ? "Erro na última verificação" : "Conectado"}
            </Badge>
          ) : (
            <Badge variant="default">Sem chave</Badge>
          )}
        </div>
        <a
          href={provider.keyUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Gerar chave <ExternalLink size={12} />
        </a>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{provider.pricingNote}</p>
      {provider.source && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-mono">{provider.maskedKey}</span> · {PROVIDER_STATUS[provider.source]}
          {provider.models.length > 0 &&
            ` · ${provider.models.length} modelos${free > 0 ? ` (${free} gratuitos)` : ""}`}
        </p>
      )}
      {provider.lastError && <p className="mt-1 text-xs text-destructive">{provider.lastError}</p>}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <Input
            type="password"
            autoComplete="off"
            label={provider.source ? "Trocar chave" : "Chave de API"}
            placeholder="Cole a chave aqui"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <Button
          type="button"
          className="h-10"
          disabled={apiKey.trim().length < 8}
          loading={busy === "save"}
          onClick={() =>
            void run("save", () => api.patch(`/api/admin/ai/providers/${provider.id}`, { apiKey: apiKey.trim() }), "Chave validada e salva")
          }
        >
          Validar e salvar
        </Button>
        {provider.source && (
          <Button
            type="button"
            variant="outline"
            className="h-10"
            loading={busy === "refresh"}
            onClick={() => void run("refresh", () => api.post(`/api/admin/ai/providers/${provider.id}/refresh`, {}), "Modelos atualizados")}
          >
            <RefreshCw size={14} /> Atualizar modelos
          </Button>
        )}
        {provider.source === "admin" && (
          <Button
            type="button"
            variant="ghost"
            className="h-10"
            loading={busy === "remove"}
            onClick={() => void run("remove", () => api.delete(`/api/admin/ai/providers/${provider.id}`), "Chave do painel removida")}
          >
            Remover chave
          </Button>
        )}
      </div>
    </div>
  );
}

const selectClass =
  "h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50";

function SlotPicker({
  slot,
  providers,
  provider,
  model,
  onChange,
  onRefreshed,
}: {
  slot: (typeof SLOTS)[number];
  providers: ProviderStatus[];
  provider: ProviderId;
  model: string;
  onChange: (provider: ProviderId, model: string) => void;
  onRefreshed: (status: ProviderStatus) => void;
}) {
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const available = providers.filter((p) => p.source || p.id === provider);
  const current = providers.find((p) => p.id === provider);
  const models = current?.models ?? [];
  const free = models.filter((m) => m.tier === "free");
  const paid = models.filter((m) => m.tier === "paid");
  const known = models.some((m) => m.id === model);

  async function refresh() {
    setRefreshing(true);
    try {
      onRefreshed(await api.post<ProviderStatus>(`/api/admin/ai/providers/${provider}/refresh`, {}));
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Não foi possível buscar os modelos", variant: "error" });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="border-b border-border/40 pb-5 last:border-0 last:pb-0">
      <p className="text-sm font-medium text-foreground">{slot.label}</p>
      <p className="mb-2 text-xs text-muted-foreground">{slot.description}</p>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <select
          aria-label={`Provedor — ${slot.label}`}
          className={selectClass}
          value={provider}
          onChange={(e) => {
            const next = providers.find((p) => p.id === e.target.value);
            if (!next) return;
            // Troca de provedor: começa no primeiro modelo da lista (gratuito, se houver).
            onChange(next.id, next.models[0]?.id ?? "");
          }}
        >
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {!p.source ? " (sem chave)" : ""}
            </option>
          ))}
        </select>
        {models.length > 0 ? (
          <select
            aria-label={`Modelo — ${slot.label}`}
            className={selectClass}
            value={model}
            onChange={(e) => onChange(provider, e.target.value)}
          >
            {!known && model && <option value={model}>{model} (atual, fora da lista)</option>}
            {free.length > 0 && (
              <optgroup label="Gratuitos">
                {free.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            )}
            {paid.length > 0 && (
              <optgroup label="Pagos">
                {paid.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        ) : (
          <div className={cn("flex items-center justify-between gap-2 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground", "h-10")}>
            <span className="truncate">{model || "Sem modelos carregados"}</span>
            {current?.source && (
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={refreshing}
                className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground hover:underline disabled:opacity-50"
              >
                <RefreshCw size={12} className={refreshing ? "animate-spin" : undefined} /> Buscar modelos
              </button>
            )}
          </div>
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
