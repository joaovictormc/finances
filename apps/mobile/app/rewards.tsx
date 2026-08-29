import { useCallback, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Modal } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";
import { SpinWheel } from "@/components/spin-wheel";
import { ConfettiBurst } from "@/components/confetti-burst";

type Profile = {
  points: number;
  prizes: { label: string; points: number }[];
  extraSpinCost: number;
};

type BadgeInfo = { slug: string; label: string; icon: string; cost: number };
type BadgesResponse = { catalog: BadgeInfo[]; unlockedBadges: string[]; activeBadge: string | null; points: number };

type SpinApiResult = { prizeLabel: string; prizePoints: number; points: number; level: number };

type SpinHistoryEntry = { prizeLabel: string; prizePoints: number; source: "weekly" | "purchased"; createdAt: string };

const SOURCE_LABELS: Record<SpinHistoryEntry["source"], string> = {
  weekly: "Giro grátis",
  purchased: "Giro comprado",
};

export default function RewardsScreen() {
  const { colors } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [badgesData, setBadgesData] = useState<BadgesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [buying, setBuying] = useState(false);
  const [wheelTargetIndex, setWheelTargetIndex] = useState<number | null>(null);
  const [spinToken, setSpinToken] = useState(0);
  const [prizeResult, setPrizeResult] = useState<{ label: string; points: number } | null>(null);
  const pendingResult = useRef<SpinApiResult | null>(null);
  const [redeemingSlug, setRedeemingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SpinHistoryEntry[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<Profile>("/api/gamification/profile"),
      api.get<BadgesResponse>("/api/gamification/badges"),
    ])
      .then(([p, b]) => {
        setProfile(p);
        setBadgesData(b);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar recompensas."))
      .finally(() => setLoading(false));
    api
      .get<SpinHistoryEntry[]>("/api/gamification/history")
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  useFocusEffect(load);

  const points = badgesData?.points ?? profile?.points ?? 0;

  async function handleBuySpin() {
    if (!profile) return;
    setError(null);
    setBuying(true);
    try {
      const result = await api.post<SpinApiResult>("/api/gamification/buy-spin", {});
      const idx = profile.prizes.findIndex((p) => p.label === result.prizeLabel);
      pendingResult.current = result;
      setWheelTargetIndex(idx >= 0 ? idx : 0);
      setSpinToken((t) => t + 1);
    } catch (err) {
      setBuying(false);
      setError(err instanceof Error ? err.message : "Não foi possível comprar o giro.");
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
    api
      .get<SpinHistoryEntry[]>("/api/gamification/history")
      .then(setHistory)
      .catch(() => {});
  }

  async function handleRedeem(slug: string) {
    setError(null);
    setRedeemingSlug(slug);
    try {
      const result = await api.post<{ unlockedBadges: string[]; points: number }>("/api/gamification/badges/redeem", { slug });
      setBadgesData((prev) => (prev ? { ...prev, unlockedBadges: result.unlockedBadges, points: result.points } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível resgatar.");
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
      setError("Não foi possível atualizar o emblema.");
    }
  }

  if (loading || !profile || !badgesData) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark" contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View className="flex-row items-center gap-4 rounded-2xl border border-border bg-card p-5 dark:border-border-dark dark:bg-card-dark">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Ionicons name="sparkles" size={22} color={colors.primary} />
        </View>
        <View>
          <Text className="text-2xl font-bold text-foreground dark:text-foreground-dark">{points} pontos</Text>
          <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
            Ganhe mais registrando transações e girando a Roleta Semanal
          </Text>
        </View>
      </View>

      <View className="rounded-2xl border border-border bg-card p-5 dark:border-border-dark dark:bg-card-dark">
        <Text className="mb-1 text-base font-semibold text-foreground dark:text-foreground-dark">Giro avulso</Text>
        <Text className="mb-4 text-sm text-muted-foreground dark:text-muted-foreground-dark">
          Não quer esperar a sequência de 7 dias? Gaste {profile.extraSpinCost} pontos e gire a roleta agora mesmo.
        </Text>

        {profile.prizes.length > 0 && (
          <View className="items-center">
            <SpinWheel
              prizes={profile.prizes}
              targetIndex={wheelTargetIndex}
              spinToken={spinToken}
              onSpinEnd={handleWheelSpinEnd}
              size={170}
            />
          </View>
        )}

        <Pressable
          onPress={handleBuySpin}
          disabled={buying || points < profile.extraSpinCost}
          className="mt-4 items-center rounded-xl bg-primary py-3"
          style={{ opacity: buying || points < profile.extraSpinCost ? 0.5 : 1 }}
        >
          {buying ? (
            <ActivityIndicator size="small" color="#1C1C1E" />
          ) : (
            <Text className="text-sm font-medium text-primary-foreground dark:text-primary-foreground-dark">
              {points < profile.extraSpinCost
                ? `Precisa de ${profile.extraSpinCost} pontos`
                : `Comprar giro (${profile.extraSpinCost} pontos)`}
            </Text>
          )}
        </Pressable>
      </View>

      <View className="rounded-2xl border border-border bg-card p-5 dark:border-border-dark dark:bg-card-dark">
        <Text className="mb-1 text-base font-semibold text-foreground dark:text-foreground-dark">Emblemas</Text>
        <Text className="mb-4 text-sm text-muted-foreground dark:text-muted-foreground-dark">
          Resgate com pontos e escolha um pra exibir perto do seu nome. Puramente cosmético.
        </Text>

        <View className="flex-row flex-wrap gap-3">
          {badgesData.catalog.map((badge) => {
            const unlocked = badgesData.unlockedBadges.includes(badge.slug);
            const active = badgesData.activeBadge === badge.slug;
            return (
              <View
                key={badge.slug}
                className="items-center gap-1.5 rounded-xl border p-4"
                style={{
                  width: "47%",
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? `${colors.primary}0D` : "transparent",
                }}
              >
                <Text style={{ fontSize: 26, opacity: unlocked ? 1 : 0.3 }}>{badge.icon}</Text>
                <Text className="text-center text-sm font-medium text-foreground dark:text-foreground-dark">
                  {badge.label}
                </Text>
                {unlocked ? (
                  <Pressable
                    onPress={() => handleToggleEquip(badge.slug)}
                    className="mt-1 flex-row items-center gap-1 rounded-full px-2.5 py-1"
                    style={{ backgroundColor: active ? colors.primary : colors.border }}
                  >
                    {active && <Ionicons name="checkmark" size={11} color="#1C1C1E" />}
                    <Text
                      className="text-xs font-medium"
                      style={{ color: active ? "#1C1C1E" : colors.mutedForeground }}
                    >
                      {active ? "Equipado" : "Equipar"}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => handleRedeem(badge.slug)}
                    disabled={redeemingSlug === badge.slug || points < badge.cost}
                    className="mt-1 rounded-full bg-primary/10 px-2.5 py-1"
                    style={{ opacity: redeemingSlug === badge.slug || points < badge.cost ? 0.4 : 1 }}
                  >
                    <Text className="text-xs font-medium text-primary">
                      {redeemingSlug === badge.slug ? "Resgatando..." : `Resgatar · ${badge.cost} pts`}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {history.length > 0 && (
        <View className="rounded-2xl border border-border bg-card p-5 dark:border-border-dark dark:bg-card-dark">
          <Text className="mb-1 text-base font-semibold text-foreground dark:text-foreground-dark">
            Histórico de giros
          </Text>
          <Text className="mb-3 text-sm text-muted-foreground dark:text-muted-foreground-dark">
            Seus últimos prêmios sorteados
          </Text>
          {history.map((h, i) => (
            <View
              key={i}
              className="flex-row items-center justify-between border-t border-border py-2 dark:border-border-dark"
            >
              <View className="flex-1 pr-2">
                <Text className="text-sm text-foreground dark:text-foreground-dark">{h.prizeLabel}</Text>
                <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                  {SOURCE_LABELS[h.source]} · {new Date(h.createdAt).toLocaleDateString("pt-BR")}
                </Text>
              </View>
              <Text className="font-medium text-foreground dark:text-foreground-dark">+{h.prizePoints}</Text>
            </View>
          ))}
        </View>
      )}

      {error && <Text className="text-center text-xs text-destructive">{error}</Text>}

      <Modal visible={prizeResult !== null} transparent animationType="fade" onRequestClose={() => setPrizeResult(null)}>
        <View className="flex-1 items-center justify-center bg-black/40 p-6">
          <View className="relative w-full max-w-xs items-center overflow-hidden rounded-2xl border border-border bg-card p-8 dark:border-border-dark dark:bg-card-dark">
            <ConfettiBurst />
            <Ionicons name="sparkles" size={32} color={colors.primary} />
            <Text className="mt-3 text-center text-lg font-bold text-foreground dark:text-foreground-dark">
              {prizeResult?.label}
            </Text>
            <Text className="mt-1 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
              +{prizeResult?.points} pontos!
            </Text>
            <Pressable onPress={() => setPrizeResult(null)} className="mt-5 w-full rounded-xl bg-primary py-2.5">
              <Text className="text-center text-sm font-medium text-primary-foreground dark:text-primary-foreground-dark">
                Fechar
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
