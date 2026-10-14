"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Check } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { queryKeys, useGamificationProfile, type GamificationProfile } from "@/lib/queries";
import { useToast } from "@/components/ui/toast-provider";

export type CheckinResult = { streak: number; reward: number; points: number; level: number };

// Acima disso as bolinhas não cabem numa linha no celular: vira barra.
const MAX_DOTS = 10;

/**
 * Botão de check-in diário + progresso até a próxima recompensa. Lê e grava
 * no cache compartilhado do perfil, então o badge de pontos da sidebar e o
 * card de Progresso atualizam junto.
 */
export function DailyCheckin({
  className,
  onCheckin,
}: {
  className?: string;
  /** Pra telas que guardam os pontos num estado próprio (Recompensas). */
  onCheckin?: (result: CheckinResult) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profile } = useGamificationProfile();
  const [loading, setLoading] = useState(false);

  if (!profile?.checkin.enabled) return null;
  const { streak, checkedInToday, rewardDays, rewardPoints } = profile.checkin;

  // Posição dentro do ciclo atual. No dia em que fecha o ciclo o resto da
  // divisão é 0, mas a barra tem que aparecer cheia, não vazia.
  const inCycle = streak % rewardDays;
  const filled = checkedInToday && streak > 0 && inCycle === 0 ? rewardDays : inCycle;
  const daysLeft = rewardDays - filled;

  async function handleCheckin() {
    setLoading(true);
    try {
      const result = await api.post<CheckinResult>("/api/gamification/checkin", {});
      queryClient.setQueryData<GamificationProfile>(queryKeys.gamificationProfile, (prev) =>
        prev
          ? {
              ...prev,
              points: result.points,
              level: result.level,
              checkin: { ...prev.checkin, streak: result.streak, checkedInToday: true },
            }
          : prev
      );
      onCheckin?.(result);
      toast(
        result.reward > 0
          ? {
              title: `+${result.reward} pontos!`,
              description: `${result.streak} dias seguidos de check-in. Continue assim!`,
              variant: "success",
            }
          : {
              title: "Check-in feito!",
              description: `${result.streak} ${result.streak === 1 ? "dia" : "dias"} seguidos.`,
              variant: "success",
            }
      );
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Não foi possível fazer o check-in", variant: "error" });
      // Provável "já fez hoje" em outra aba/dispositivo: busca o estado real.
      void queryClient.invalidateQueries({ queryKey: queryKeys.gamificationProfile });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-sm font-medium text-foreground inline-flex items-center gap-1.5">
          <CalendarCheck size={15} className="text-primary" />
          Check-in diário
        </p>
        <span className="text-xs text-muted-foreground">
          {filled}/{rewardDays}
        </span>
      </div>

      {rewardDays <= MAX_DOTS ? (
        <div className="flex gap-1.5 mb-2" aria-hidden>
          {Array.from({ length: rewardDays }, (_, i) => (
            <span
              key={i}
              className={cn("h-1.5 flex-1 rounded-full", i < filled ? "bg-primary" : "bg-muted")}
            />
          ))}
        </div>
      ) : (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-2" aria-hidden>
          <div className="h-full rounded-full bg-primary" style={{ width: `${(filled / rewardDays) * 100}%` }} />
        </div>
      )}

      <p className="text-xs text-muted-foreground mb-3">
        {daysLeft === 0
          ? `Ciclo completo! Você ganhou ${rewardPoints} pontos.`
          : `Faltam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"} seguidos pra ganhar ${rewardPoints} pontos.`}
      </p>

      <button
        type="button"
        onClick={handleCheckin}
        disabled={checkedInToday || loading}
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-xl text-sm font-medium py-2.5 transition-opacity",
          checkedInToday
            ? "bg-muted text-muted-foreground cursor-default"
            : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60"
        )}
      >
        {checkedInToday ? (
          <>
            <Check size={16} /> Check-in de hoje feito
          </>
        ) : loading ? (
          "Fazendo check-in..."
        ) : (
          "Fazer check-in"
        )}
      </button>
    </div>
  );
}
