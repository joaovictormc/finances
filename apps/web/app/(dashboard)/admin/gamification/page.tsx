"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type SpinPrize = { label: string; points: number };
type GamificationSettings = { spinPrizes: SpinPrize[] };

// Estado do formulário mantém `points` como string pra digitação livre (apagar,
// colar, redigitar) — só vira número na hora de salvar.
type PrizeDraft = { label: string; points: string };

export default function AdminGamificationPage() {
  const { toast } = useToast();
  const [prizes, setPrizes] = useState<PrizeDraft[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invalidIndexes, setInvalidIndexes] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const settings = await api.get<GamificationSettings>("/api/admin/gamification/settings");
      setPrizes(settings.spinPrizes.map((p) => ({ label: p.label, points: String(p.points) })));
    } catch {
      toast({ title: "Erro ao carregar prêmios da roleta", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  function updateLabel(index: number, value: string) {
    if (!prizes) return;
    const next = [...prizes];
    next[index] = { ...next[index]!, label: value };
    setPrizes(next);
    setInvalidIndexes((prev) => {
      if (!prev.has(index)) return prev;
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
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
    setInvalidIndexes((prev) => {
      if (!prev.has(index)) return prev;
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }

  function removePrize(index: number) {
    if (!prizes) return;
    setPrizes(prizes.filter((_, i) => i !== index));
  }

  function addPrize() {
    if (!prizes) return;
    if (prizes.length >= 10) return;
    setPrizes([...prizes, { label: "", points: "10" }]);
  }

  async function handleSave() {
    if (!prizes) return;

    // Valida tudo antes de salvar — nunca descarta silenciosamente o que o usuário
    // digitou. Se algo estiver incompleto/inválido, avisa, destaca o campo exato
    // (label ou pontos) e não salva nada.
    const invalid = new Set<number>();
    const parsed: SpinPrize[] = prizes.map((p, i) => {
      const label = p.label.trim();
      const points = Number(p.points.trim());
      if (!label || !Number.isFinite(points) || points <= 0) invalid.add(i);
      return { label, points };
    });
    setInvalidIndexes(invalid);
    if (invalid.size > 0) {
      const positions = [...invalid].map((i) => i + 1).join(", ");
      toast({
        title: `Prêmio inválido na posição ${positions} — preencha o rótulo (texto) e os pontos (número maior que zero)`,
        variant: "error",
      });
      return;
    }

    setSaving(true);
    try {
      const settings = await api.patch<GamificationSettings>("/api/admin/gamification/settings", {
        spinPrizes: parsed,
      });
      setPrizes(settings.spinPrizes.map((p) => ({ label: p.label, points: String(p.points) })));
      toast({ title: "Prêmios salvos", variant: "success" });
    } catch {
      toast({ title: "Erro ao salvar prêmios", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !prizes) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
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
          Cada usuário elegível (streak ≥ 7 dias) sorteia um destes prêmios por semana — o rótulo é
          o que aparece pro usuário, e os pontos são aplicados ao perfil. O sorteio é sempre feito no
          servidor.
        </p>

        <div className="flex items-center gap-2 mb-1.5 px-0.5">
          <span className="flex-[2] text-xs font-medium text-muted-foreground">Rótulo</span>
          <span className="flex-1 text-xs font-medium text-muted-foreground">Pontos</span>
          <span className="w-9 shrink-0" />
        </div>

        <div className="space-y-2">
          {prizes.map((prize, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="ex: Cupom de desconto"
                value={prize.label}
                onChange={(e) => updateLabel(i, e.target.value)}
                className={cn("flex-[2]", invalidIndexes.has(i) && "border-destructive")}
              />
              <Input
                type="text"
                inputMode="numeric"
                placeholder="ex: 50"
                value={prize.points}
                onChange={(e) => updatePoints(i, e.target.value)}
                className={cn("flex-1", invalidIndexes.has(i) && "border-destructive")}
              />
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
          ))}
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
    </div>
  );
}
