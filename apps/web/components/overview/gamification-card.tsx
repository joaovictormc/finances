"use client";

import { useEffect, useState } from "react";
import { Flame, Sparkles } from "lucide-react";
import { api } from "@/lib/api-client";
import { ProgressRing } from "@/components/ui/progress-ring";
import { cn } from "@/lib/utils";

type GamificationProfile = {
  points: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  spinUnlockStreak: number;
  canSpin: boolean;
};

// Mesma tabela de LEVEL_THRESHOLDS de apps/api/src/lib/gamification.ts — só pra
// desenhar a barra de progresso até o próximo nível (a fonte da verdade do
// nível em si continua sendo o backend).
const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000];

function progressToNextLevel(points: number, level: number): number {
  const floor = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const ceil = LEVEL_THRESHOLDS[level] ?? floor + 500;
  if (ceil === floor) return 1;
  return Math.min(Math.max((points - floor) / (ceil - floor), 0), 1);
}

export function GamificationCard() {
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [prizeResult, setPrizeResult] = useState<{ label: string; points: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<GamificationProfile>("/api/gamification/profile")
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  if (!profile) return null;

  const handleSpin = async () => {
    setError(null);
    setSpinning(true);
    try {
      const result = await api.post<{ prizeLabel: string; prizePoints: number; points: number; level: number }>(
        "/api/gamification/spin",
        {}
      );
      // Deixa a animação girar um pouco antes de revelar o prêmio.
      setTimeout(() => {
        setPrizeResult({ label: result.prizeLabel, points: result.prizePoints });
        setProfile((prev) => (prev ? { ...prev, points: result.points, level: result.level, canSpin: false } : prev));
        setSpinning(false);
      }, 1200);
    } catch (err) {
      setSpinning(false);
      setError(err instanceof Error ? err.message : "Não foi possível girar a roleta");
    }
  };

  const progress = progressToNextLevel(profile.points, profile.level);

  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">Progresso</h2>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Flame size={14} className={cn(profile.currentStreak > 0 && "text-warning")} />
          {profile.currentStreak} {profile.currentStreak === 1 ? "dia" : "dias"} seguidos
        </span>
      </div>

      <div className="flex items-center gap-4">
        <ProgressRing value={progress} size={56} strokeWidth={5}>
          <span className="text-xs font-bold text-foreground">{profile.level}</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Nível {profile.level}</p>
          <p className="text-xs text-muted-foreground">{profile.points} pontos acumulados</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border/60">
        {profile.canSpin ? (
          <button
            onClick={handleSpin}
            disabled={spinning}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            <Sparkles size={16} className={cn(spinning && "animate-spin")} />
            {spinning ? "Girando..." : "Girar Roleta Semanal"}
          </button>
        ) : (
          <p className="text-xs text-muted-foreground text-center">
            Mantenha {profile.spinUnlockStreak} dias seguidos registrando transações pra desbloquear a Roleta Semanal.
          </p>
        )}
        {error && <p className="text-xs text-destructive mt-2 text-center">{error}</p>}
      </div>

      {prizeResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPrizeResult(null)}
        >
          <div
            className="bg-card rounded-2xl border border-border/60 shadow-lg p-8 text-center max-w-xs w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Sparkles size={32} className="mx-auto text-primary mb-3" />
            <p className="text-lg font-bold text-foreground">{prizeResult.label}</p>
            <p className="text-sm text-muted-foreground mt-1">+{prizeResult.points} pontos! Volta semana que vem pra girar de novo.</p>
            <button
              onClick={() => setPrizeResult(null)}
              className="mt-5 w-full rounded-xl bg-primary text-primary-foreground text-sm font-medium py-2.5 hover:opacity-90 transition-opacity"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
