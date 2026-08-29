"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Check, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { SpinWheel } from "@/components/ui/spin-wheel";
import { ConfettiBurst } from "@/components/ui/confetti-burst";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Profile = {
  points: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  spinUnlockStreak: number;
  prizes: { label: string; points: number }[];
  extraSpinCost: number;
};

// Mesma tabela de LEVEL_THRESHOLDS de apps/api/src/lib/gamification.ts — só pra
// mostrar quanto falta pro próximo nível.
const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000];

type BadgeInfo = { slug: string; label: string; icon: string; cost: number };
type BadgesResponse = { catalog: BadgeInfo[]; unlockedBadges: string[]; activeBadge: string | null; points: number };

type SpinApiResult = { prizeLabel: string; prizePoints: number; points: number; level: number };

type SpinHistoryEntry = { prizeLabel: string; prizePoints: number; source: "weekly" | "purchased"; createdAt: string };

const SOURCE_LABELS: Record<SpinHistoryEntry["source"], string> = {
  weekly: "Giro grátis",
  purchased: "Giro comprado",
};

export default function RewardsPage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [badgesData, setBadgesData] = useState<BadgesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [buying, setBuying] = useState(false);
  const [wheelTargetIndex, setWheelTargetIndex] = useState<number | null>(null);
  const [spinToken, setSpinToken] = useState(0);
  const [prizeResult, setPrizeResult] = useState<{ label: string; points: number } | null>(null);
  const pendingResult = useRef<SpinApiResult | null>(null);

  const [redeemingSlug, setRedeemingSlug] = useState<string | null>(null);
  const [history, setHistory] = useState<SpinHistoryEntry[]>([]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [p, b] = await Promise.all([
        api.get<Profile>("/api/gamification/profile"),
        api.get<BadgesResponse>("/api/gamification/badges"),
      ]);
      setProfile(p);
      setBadgesData(b);
    } catch {
      toast({ title: "Erro ao carregar recompensas", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadHistory = useCallback(async () => {
    try {
      const h = await api.get<SpinHistoryEntry[]>("/api/gamification/history");
      setHistory(h);
    } catch {
      // Histórico é um complemento — falha aqui não impede o resto da tela.
    }
  }, []);

  useEffect(() => { load(); loadHistory(); }, [load, loadHistory]);

  const points = badgesData?.points ?? profile?.points ?? 0;

  async function handleBuySpin() {
    if (!profile) return;
    setBuying(true);
    try {
      const result = await api.post<SpinApiResult>("/api/gamification/buy-spin", {});
      const idx = profile.prizes.findIndex((p) => p.label === result.prizeLabel);
      pendingResult.current = result;
      setWheelTargetIndex(idx >= 0 ? idx : 0);
      setSpinToken((t) => t + 1);
    } catch (err) {
      setBuying(false);
      toast({ title: err instanceof Error ? err.message : "Não foi possível comprar o giro", variant: "error" });
    }
  }

  function handleWheelSpinEnd() {
    const result = pendingResult.current;
    if (!result) return;
    pendingResult.current = null;
    setPrizeResult({ label: result.prizeLabel, points: result.prizePoints });
    setProfile((prev) => (prev ? { ...prev, points: result.points } : prev));
    setBadgesData((prev) => (prev ? { ...prev, points: result.points } : prev));
    setBuying(false);
    loadHistory();
  }

  async function handleRedeem(slug: string) {
    setRedeemingSlug(slug);
    try {
      const result = await api.post<{ unlockedBadges: string[]; points: number }>("/api/gamification/badges/redeem", { slug });
      setBadgesData((prev) => (prev ? { ...prev, unlockedBadges: result.unlockedBadges, points: result.points } : prev));
      toast({ title: "Emblema desbloqueado!", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Não foi possível resgatar", variant: "error" });
    } finally {
      setRedeemingSlug(null);
    }
  }

  async function handleToggleEquip(slug: string) {
    const nextActive = badgesData?.activeBadge === slug ? null : slug;
    try {
      const result = await api.patch<{ activeBadge: string | null }>("/api/gamification/badges/active", { slug: nextActive });
      setBadgesData((prev) => (prev ? { ...prev, activeBadge: result.activeBadge } : prev));
    } catch {
      toast({ title: "Não foi possível atualizar o emblema", variant: "error" });
    }
  }

  if (isLoading || !profile || !badgesData) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  const nextThreshold = LEVEL_THRESHOLDS[profile.level] ?? null;
  const pointsToNext = nextThreshold !== null ? Math.max(nextThreshold - profile.points, 0) : null;

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Recompensas</h1>
        <p className="text-muted-foreground text-sm mt-1">Use os pontos que você acumula registrando transações</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-6">
        <div className="sm:col-span-2 bg-card rounded-2xl border border-border/60 shadow-sm p-6 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles size={22} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{points} pontos</p>
            <p className="text-xs text-muted-foreground">Ganhe mais registrando transações e girando a Roleta Semanal</p>
          </div>
        </div>

        <div className="sm:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatTile label="Nível" value={String(profile.level)} />
          <StatTile label="Sequência atual" value={`${profile.currentStreak} dia${profile.currentStreak === 1 ? "" : "s"}`} />
          <StatTile label="Maior sequência" value={`${profile.longestStreak} dia${profile.longestStreak === 1 ? "" : "s"}`} />
        </div>
      </div>

      {pointsToNext !== null && (
        <p className="text-xs text-muted-foreground mb-6 -mt-2">
          Faltam <span className="font-medium text-foreground">{pointsToNext} pontos</span> pro nível {profile.level + 1}.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1">Giro avulso</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Não quer esperar a sequência de 7 dias? Gaste {profile.extraSpinCost} pontos e gire a roleta agora mesmo.
          </p>

          {profile.prizes.length > 0 && (
            <SpinWheel
              prizes={profile.prizes}
              targetIndex={wheelTargetIndex}
              spinToken={spinToken}
              onSpinEnd={handleWheelSpinEnd}
              size={190}
            />
          )}

          <div className="mt-4 flex justify-center">
            <Button onClick={handleBuySpin} loading={buying} disabled={points < profile.extraSpinCost}>
              {points < profile.extraSpinCost
                ? `Precisa de ${profile.extraSpinCost} pontos`
                : `Comprar giro (${profile.extraSpinCost} pontos)`}
            </Button>
          </div>
        </section>

        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1">Emblemas</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Resgate emblemas com pontos e escolha um pra exibir perto do seu nome (ranking do grupo, por exemplo).
            Puramente cosmético.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {badgesData.catalog.map((badge) => {
            const unlocked = badgesData.unlockedBadges.includes(badge.slug);
            const active = badgesData.activeBadge === badge.slug;
            return (
              <div
                key={badge.slug}
                className={cn(
                  "rounded-xl border p-4 flex flex-col items-center text-center gap-1.5",
                  active ? "border-primary bg-primary/5" : "border-border/60"
                )}
              >
                <span className={cn("text-2xl", !unlocked && "grayscale opacity-40")}>{badge.icon}</span>
                <p className="text-sm font-medium text-foreground">{badge.label}</p>
                {unlocked ? (
                  <button
                    onClick={() => handleToggleEquip(badge.slug)}
                    className={cn(
                      "mt-1 flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1",
                      active ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {active && <Check size={11} />}
                    {active ? "Equipado" : "Equipar"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleRedeem(badge.slug)}
                    disabled={redeemingSlug === badge.slug || points < badge.cost}
                    className="mt-1 text-xs font-medium rounded-full px-2.5 py-1 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 disabled:hover:bg-primary/10"
                  >
                    {redeemingSlug === badge.slug ? "Resgatando..." : `Resgatar · ${badge.cost} pts`}
                  </button>
                )}
              </div>
            );
          })}
          </div>
        </section>
      </div>

      {history.length > 0 && (
        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 mt-6">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <History size={16} className="text-muted-foreground" />
            Histórico de giros
          </h2>
          <p className="text-sm text-muted-foreground mb-4">Seus últimos prêmios sorteados</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/40 text-sm">
                <div className="min-w-0">
                  <p className="text-foreground truncate">{h.prizeLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {SOURCE_LABELS[h.source]} · {new Date(h.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className="shrink-0 ml-2 font-medium text-foreground">+{h.prizePoints}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {prizeResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPrizeResult(null)}
        >
          <div
            className="relative bg-card rounded-2xl border border-border/60 shadow-lg p-8 text-center max-w-xs w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <ConfettiBurst />
            <Sparkles size={32} className="mx-auto text-primary mb-3" />
            <p className="text-lg font-bold text-foreground">{prizeResult.label}</p>
            <p className="text-sm text-muted-foreground mt-1">+{prizeResult.points} pontos!</p>
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

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4 flex flex-col justify-center">
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
