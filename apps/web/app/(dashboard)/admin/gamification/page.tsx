"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X, FlaskConical, Sparkles, BarChart3 } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { SpinWheel } from "@/components/ui/spin-wheel";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type SpinPrizeType = "points" | "plan_days";
type PrizePlan = "pro" | "familia";

type SpinPrize = {
  label: string;
  type: SpinPrizeType;
  points: number;
  days: number;
  plan: PrizePlan;
  weight: number;
};
type GamificationSettings = { spinPrizes: SpinPrize[] };

const TYPE_OPTIONS = [
  { value: "points", label: "Pontos" },
  { value: "plan_days", label: "Dias de plano" },
];

const PLAN_OPTIONS = [
  { value: "pro", label: "Pro" },
  { value: "familia", label: "Família" },
];

type SimulationResult = {
  label: string;
  points: number;
  weight: number;
  configuredProbability: number;
  count: number;
  observedProbability: number;
};

// Estado do formulário mantém os números como string pra digitação livre
// (apagar, colar, redigitar) — só vira número na hora de salvar.
type PrizeDraft = {
  label: string;
  type: SpinPrizeType;
  points: string;
  days: string;
  plan: PrizePlan;
  weight: string;
};

function toDraft(prize: SpinPrize): PrizeDraft {
  return {
    label: prize.label,
    type: prize.type,
    points: String(prize.points),
    days: String(prize.days),
    plan: prize.plan,
    weight: String(prize.weight),
  };
}

type GamificationStats = {
  activeUsers: number;
  spinsThisWeek: number;
  totalSpins: number;
  levelDistribution: { level: number; count: number }[];
  badgeRedemptions: { slug: string; label: string; icon: string; count: number }[];
  topPrizes: { label: string; count: number }[];
};

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** O que o prêmio entrega, em uma linha — usado no resultado do teste da roleta. */
function prizeSummary(prize: SpinPrize): string {
  if (prize.type !== "plan_days") return `+${prize.points} pontos`;
  const planName = prize.plan === "familia" ? "Família" : "Pro";
  return `+${prize.days} ${prize.days === 1 ? "dia" : "dias"} de ${planName}`;
}

export default function AdminGamificationPage() {
  const { toast } = useToast();
  const [prizes, setPrizes] = useState<PrizeDraft[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invalidIndexes, setInvalidIndexes] = useState<Set<number>>(new Set());

  const [spinsInput, setSpinsInput] = useState("1000");
  const [simulating, setSimulating] = useState(false);
  const [simulation, setSimulation] = useState<SimulationResult[] | null>(null);

  // Prêmios já salvos (não o rascunho em edição) — é o que a roleta visual usa,
  // igual à "Testar roleta": sempre reflete o que está de fato configurado.
  const [savedPrizes, setSavedPrizes] = useState<SpinPrize[]>([]);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelTargetIndex, setWheelTargetIndex] = useState<number | null>(null);
  const [wheelSpinToken, setWheelSpinToken] = useState(0);
  const [wheelResult, setWheelResult] = useState<SpinPrize | null>(null);

  const [stats, setStats] = useState<GamificationStats | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const settings = await api.get<GamificationSettings>("/api/admin/gamification/settings");
      setPrizes(settings.spinPrizes.map(toDraft));
      setSavedPrizes(settings.spinPrizes);
    } catch {
      toast({ title: "Erro ao carregar prêmios da roleta", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadStats = useCallback(async () => {
    try {
      const s = await api.get<GamificationStats>("/api/admin/gamification/stats");
      setStats(s);
    } catch {
      // Estatísticas são um complemento — falha aqui não impede o resto da tela.
    }
  }, []);

  useEffect(() => { load(); loadStats(); }, [load, loadStats]);

  function clearInvalid(index: number) {
    setInvalidIndexes((prev) => {
      if (!prev.has(index)) return prev;
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }

  function updateLabel(index: number, value: string) {
    if (!prizes) return;
    const next = [...prizes];
    next[index] = { ...next[index]!, label: value };
    setPrizes(next);
    clearInvalid(index);
  }

  function updatePoints(index: number, value: string) {
    if (!prizes) return;
    // Só dígitos — impede digitar texto no campo errado (já aconteceu: usuário
    // descreveu o prêmio aqui em vez de no rótulo, e a validação barrava sem
    // deixar claro qual campo estava errado).
    const digitsOnly = value.replace(/\D/g, "");
    const next = [...prizes];
    next[index] = { ...next[index]!, points: digitsOnly };
    setPrizes(next);
    clearInvalid(index);
  }

  function updateField(index: number, patch: Partial<PrizeDraft>) {
    if (!prizes) return;
    const next = [...prizes];
    next[index] = { ...next[index]!, ...patch };
    setPrizes(next);
    clearInvalid(index);
  }

  function updateDays(index: number, value: string) {
    updateField(index, { days: value.replace(/D/g, "") });
  }

  function updateWeight(index: number, value: string) {
    if (!prizes) return;
    const digitsOnly = value.replace(/\D/g, "");
    const next = [...prizes];
    next[index] = { ...next[index]!, weight: digitsOnly };
    setPrizes(next);
    clearInvalid(index);
  }

  function removePrize(index: number) {
    if (!prizes) return;
    setPrizes(prizes.filter((_, i) => i !== index));
  }

  function addPrize() {
    if (!prizes) return;
    if (prizes.length >= 10) return;
    setPrizes([...prizes, { label: "", type: "points", points: "10", days: "30", plan: "pro", weight: "1" }]);
  }

  // Probabilidade configurada calculada ao vivo, só pra dar feedback visual
  // enquanto o admin ajusta os pesos — o cálculo real acontece no backend.
  const livePercentages = useMemo(() => {
    if (!prizes) return [];
    const weights = prizes.map((p) => Number(p.weight));
    const total = weights.reduce((sum, w) => sum + (Number.isFinite(w) && w > 0 ? w : 0), 0);
    return weights.map((w) => (total > 0 && Number.isFinite(w) && w > 0 ? w / total : 0));
  }, [prizes]);

  async function handleSave() {
    if (!prizes) return;

    // Valida tudo antes de salvar — nunca descarta silenciosamente o que o usuário
    // digitou. Se algo estiver incompleto/inválido, avisa, destaca o campo exato
    // e não salva nada.
    const invalid = new Set<number>();
    const parsed: SpinPrize[] = prizes.map((p, i) => {
      const label = p.label.trim();
      const weight = Number(p.weight.trim());
      const isPlanDays = p.type === "plan_days";
      // O campo cobrado é o do tipo escolhido: prêmio de dias não precisa de
      // pontos, e vice-versa.
      const points = isPlanDays ? 0 : Number(p.points.trim());
      const days = isPlanDays ? Number(p.days.trim()) : 0;
      const amount = isPlanDays ? days : points;

      if (
        !label ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        (isPlanDays && days > 365) ||
        !Number.isFinite(weight) ||
        weight <= 0
      ) {
        invalid.add(i);
      }
      return { label, type: p.type, points, days, plan: p.plan, weight };
    });
    setInvalidIndexes(invalid);
    if (invalid.size > 0) {
      const positions = [...invalid].map((i) => i + 1).join(", ");
      toast({
        title: `Prêmio inválido na posição ${positions} — preencha rótulo, peso e o valor do tipo escolhido (pontos, ou dias entre 1 e 365)`,
        variant: "error",
      });
      return;
    }

    setSaving(true);
    try {
      const settings = await api.patch<GamificationSettings>("/api/admin/gamification/settings", {
        spinPrizes: parsed,
      });
      setPrizes(settings.spinPrizes.map(toDraft));
      setSavedPrizes(settings.spinPrizes);
      setSimulation(null); // resultados antigos não refletem mais a config atual
      setWheelResult(null);
      toast({ title: "Prêmios salvos", variant: "success" });
    } catch {
      toast({ title: "Erro ao salvar prêmios", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSimulate() {
    const spins = Number(spinsInput);
    if (!Number.isFinite(spins) || spins < 1 || spins > 50000) {
      toast({ title: "Informe uma quantidade de giros entre 1 e 50.000", variant: "error" });
      return;
    }
    setSimulating(true);
    try {
      const result = await api.post<{ spins: number; results: SimulationResult[] }>(
        "/api/admin/gamification/simulate",
        { spins }
      );
      setSimulation(result.results);
    } catch {
      toast({ title: "Erro ao simular giros — salve os prêmios antes de testar", variant: "error" });
    } finally {
      setSimulating(false);
    }
  }

  // Prévia visual: reaproveita o endpoint de simulação com 1 giro (mesmo RNG
  // ponderado do sorteio real) só pra saber qual setor a roleta deve parar —
  // a distribuição estatística de verdade continua sendo validada em "Testar roleta".
  async function handleVisualSpin() {
    if (savedPrizes.length === 0) {
      toast({ title: "Salve os prêmios antes de testar a prévia visual", variant: "error" });
      return;
    }
    setWheelSpinning(true);
    try {
      const result = await api.post<{ spins: number; results: SimulationResult[] }>(
        "/api/admin/gamification/simulate",
        { spins: 1 }
      );
      const idx = result.results.findIndex((r) => r.count === 1);
      setWheelResult(null);
      setWheelTargetIndex(idx >= 0 ? idx : 0);
      setWheelSpinToken((t) => t + 1);
    } catch {
      setWheelSpinning(false);
      toast({ title: "Erro ao rodar a prévia visual", variant: "error" });
    }
  }

  function handleWheelSpinEnd() {
    if (wheelTargetIndex !== null) {
      setWheelResult(savedPrizes[wheelTargetIndex] ?? null);
    }
    setWheelSpinning(false);
  }

  if (isLoading || !prizes) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <BackButton href="/admin" label="Administração" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Roleta Semanal</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Defina os prêmios sorteáveis na Roleta Semanal da gamificação
        </p>
      </div>

      <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
        <h2 className="text-base font-semibold mb-1">Prêmios</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Cada usuário elegível (streak ≥ 7 dias) sorteia um destes prêmios por semana. O rótulo é o
          que aparece pro usuário e o peso define a chance de cair (não precisa somar 100 — é
          relativo aos outros pesos). O sorteio é sempre feito no servidor.
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          O <strong className="text-foreground">tipo</strong> decide o que é entregue de verdade:
          <em> Pontos</em> soma no perfil; <em>Dias de plano</em> soma dias de assinatura na hora,
          sem resgate manual. Quem já tem um plano melhor recebe os dias no plano que já tem, e não
          é rebaixado.
        </p>

        {/* Mesma estrutura aninhada (label + grupo) das linhas de dados abaixo —
            precisa ser idêntica pra as colunas baterem exatamente. */}
        <div className="hidden sm:flex items-center gap-2 mb-1.5 px-0.5">
          <span className="flex-[2] text-xs font-medium text-muted-foreground">Rótulo</span>
          <div className="flex items-center gap-2">
            <span className="w-32 shrink-0 text-xs font-medium text-muted-foreground">Tipo</span>
            <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">Valor</span>
            <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground">Plano</span>
            <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">Peso</span>
            <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground text-right">Chance</span>
            <span className="w-9 shrink-0" />
          </div>
        </div>

        <div className="space-y-2">
          {prizes.map((prize, i) => {
            const isPlanDays = prize.type === "plan_days";
            return (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-lg border border-border/40 p-2 sm:flex-row sm:items-center sm:border-0 sm:p-0"
            >
              <div className="sm:flex-[2]">
                <Input
                  type="text"
                  placeholder="ex: 30 dias de Pro"
                  value={prize.label}
                  onChange={(e) => updateLabel(i, e.target.value)}
                  className={cn(invalidIndexes.has(i) && "border-destructive")}
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 sm:w-32 sm:shrink-0">
                  <Select
                    options={TYPE_OPTIONS}
                    value={prize.type}
                    onChange={(e) =>
                      updateField(i, { type: e.target.value as SpinPrizeType })
                    }
                    className="w-full"
                  />
                </div>
                <div className="flex-1 sm:w-20 sm:shrink-0">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder={isPlanDays ? "Dias" : "Pontos"}
                    value={isPlanDays ? prize.days : prize.points}
                    onChange={(e) =>
                      isPlanDays ? updateDays(i, e.target.value) : updatePoints(i, e.target.value)
                    }
                    className={cn(invalidIndexes.has(i) && "border-destructive")}
                  />
                </div>
                <div className="flex-1 sm:w-24 sm:shrink-0">
                  {/* Só faz sentido num prêmio de dias — mantido no lugar (desabilitado)
                      pra as colunas não dançarem ao trocar o tipo de uma linha. */}
                  <Select
                    options={PLAN_OPTIONS}
                    value={prize.plan}
                    disabled={!isPlanDays}
                    onChange={(e) => updateField(i, { plan: e.target.value as PrizePlan })}
                    className="w-full"
                  />
                </div>
                <div className="flex-1 sm:w-16 sm:shrink-0">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="Peso"
                    value={prize.weight}
                    onChange={(e) => updateWeight(i, e.target.value)}
                    className={cn(invalidIndexes.has(i) && "border-destructive")}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                  {pct(livePercentages[i] ?? 0)}
                </span>
                <button
                  type="button"
                  onClick={() => removePrize(i)}
                  disabled={prizes.length <= 1}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent"
                  aria-label="Remover prêmio"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addPrize}
          disabled={prizes.length >= 10}
          className="mt-3 flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-80 disabled:opacity-40"
        >
          <Plus size={14} /> Adicionar prêmio
        </button>
      </section>

      <div className="mt-6">
        <Button onClick={handleSave} loading={saving}>Salvar prêmios</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 items-start">
        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <Sparkles size={16} className="text-muted-foreground" />
            Prévia visual
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Mostra a roleta exatamente como o usuário vê, girando até o prêmio sorteado (mesmo sorteio
            ponderado do backend). Não afeta pontos de ninguém.
          </p>

          <SpinWheel
            prizes={savedPrizes}
            targetIndex={wheelTargetIndex}
            spinToken={wheelSpinToken}
            onSpinEnd={handleWheelSpinEnd}
            size={190}
          />

          <div className="mt-4 flex flex-col items-center gap-2">
            <Button onClick={handleVisualSpin} loading={wheelSpinning} disabled={savedPrizes.length === 0}>
              Girar roleta
            </Button>
            {wheelResult && (
              <p className="text-sm text-foreground">
                Caiu em <span className="font-semibold">{wheelResult.label}</span> ({prizeSummary(wheelResult)})
              </p>
            )}
          </div>
        </section>

        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <FlaskConical size={16} className="text-muted-foreground" />
            Testar roleta
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Roda N sorteios em memória usando os prêmios já salvos (sem afetar pontos de nenhum
            usuário) e mostra quantas vezes cada prêmio saiu, pra validar se a distribuição real bate
            com a chance configurada.
          </p>

          <div className="flex items-center gap-2">
            <Input
              type="text"
              inputMode="numeric"
              value={spinsInput}
              onChange={(e) => setSpinsInput(e.target.value.replace(/\D/g, ""))}
              className="w-24 sm:w-32"
            />
            <span className="text-sm text-muted-foreground">giros</span>
            <Button onClick={handleSimulate} loading={simulating} className="ml-auto">
              Rodar simulação
            </Button>
          </div>

          {simulation && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                    <th className="py-2 pr-2 font-medium">Prêmio</th>
                    <th className="py-2 px-2 font-medium text-right">Configurado</th>
                    <th className="py-2 px-2 font-medium text-right">Sorteado</th>
                    <th className="py-2 pl-2 font-medium text-right">Vezes</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.map((r) => (
                    <tr key={r.label} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-2 text-foreground">{r.label}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{pct(r.configuredProbability)}</td>
                      <td className="py-2 px-2 text-right text-foreground font-medium">{pct(r.observedProbability)}</td>
                      <td className="py-2 pl-2 text-right text-muted-foreground">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {stats && (
        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 mt-6">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <BarChart3 size={16} className="text-muted-foreground" />
            Estatísticas de uso
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Dados reais de giros e emblemas — não é simulação.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatTile label="Usuários ativos" value={String(stats.activeUsers)} />
            <StatTile label="Giros essa semana" value={String(stats.spinsThisWeek)} />
            <StatTile label="Giros no total" value={String(stats.totalSpins)} />
            <StatTile
              label="Nível médio"
              value={
                stats.levelDistribution.length > 0
                  ? (
                      stats.levelDistribution.reduce((sum, l) => sum + l.level * l.count, 0) /
                      stats.levelDistribution.reduce((sum, l) => sum + l.count, 0)
                    ).toFixed(1)
                  : "—"
              }
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Prêmios mais sorteados</h3>
              {stats.topPrizes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ainda sem giros registrados.</p>
              ) : (
                <div className="space-y-1.5">
                  {stats.topPrizes.map((p) => (
                    <div key={p.label} className="flex items-center justify-between text-sm">
                      <span className="text-foreground truncate">{p.label}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">{p.count}×</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Emblemas mais resgatados</h3>
              <div className="space-y-1.5">
                {stats.badgeRedemptions.map((b) => (
                  <div key={b.slug} className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate">
                      {b.icon} {b.label}
                    </span>
                    <span className="text-muted-foreground shrink-0 ml-2">{b.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 p-4 text-center">
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
