import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";
import { ProgressRing } from "@/components/progress-ring";
import { SpinWheel } from "@/components/spin-wheel";
import { ConfettiBurst } from "@/components/confetti-burst";

type GamificationProfile = {
  points: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  spinUnlockStreak: number;
  canSpin: boolean;
  prizes: { label: string; points: number }[];
};

// Mesma tabela de LEVEL_THRESHOLDS de apps/api/src/lib/gamification.ts — só pra
// desenhar a barra de progresso até o próximo nível.
const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000];

function progressToNextLevel(points: number, level: number): number {
  const floor = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const ceil = LEVEL_THRESHOLDS[level] ?? floor + 500;
  if (ceil === floor) return 1;
  return Math.min(Math.max((points - floor) / (ceil - floor), 0), 1);
}

type SpinApiResult = { prizeLabel: string; prizePoints: number; points: number; level: number };

export function GamificationCard() {
  const { colors } = useTheme();
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [wheelTargetIndex, setWheelTargetIndex] = useState<number | null>(null);
  const [spinToken, setSpinToken] = useState(0);
  const [prize, setPrize] = useState<{ label: string; points: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Guarda o resultado já confirmado pelo servidor enquanto a roleta ainda está
  // girando visualmente — só aplica no state (pontos/nível/modal) quando a
  // animação terminar, pra revelação bater com o desenho da roleta.
  const pendingResult = useRef<SpinApiResult | null>(null);

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
      const result = await api.post<SpinApiResult>("/api/gamification/spin", {});
      const idx = profile.prizes.findIndex((p) => p.label === result.prizeLabel);
      pendingResult.current = result;
      setWheelTargetIndex(idx >= 0 ? idx : 0);
      setSpinToken((t) => t + 1);
    } catch (err) {
      setSpinning(false);
      setError(err instanceof Error ? err.message : "Não foi possível girar a roleta");
    }
  };

  const handleWheelSpinEnd = () => {
    const result = pendingResult.current;
    if (!result) return;
    pendingResult.current = null;
    setPrize({ label: result.prizeLabel, points: result.prizePoints });
    setProfile((prev) => (prev ? { ...prev, points: result.points, level: result.level, canSpin: false } : prev));
    setSpinning(false);
  };

  const progress = progressToNextLevel(profile.points, profile.level);

  return (
    <View className="mb-4 rounded-2xl border border-border bg-card p-5 dark:border-border-dark dark:bg-card-dark">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-base font-semibold text-foreground dark:text-foreground-dark">Progresso</Text>
        <View className="flex-row items-center gap-1">
          <Ionicons name="flame" size={14} color={profile.currentStreak > 0 ? "#F59E0B" : colors.mutedForeground} />
          <Text className="text-xs font-medium text-muted-foreground dark:text-muted-foreground-dark">
            {profile.currentStreak} {profile.currentStreak === 1 ? "dia" : "dias"} seguidos
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-4">
        <ProgressRing value={progress} size={56} strokeWidth={5}>
          <Text className="text-xs font-bold text-foreground dark:text-foreground-dark">{profile.level}</Text>
        </ProgressRing>
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">Nível {profile.level}</Text>
          <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
            {profile.points} pontos acumulados
          </Text>
        </View>
      </View>

      <View className="mt-4 border-t border-border pt-4 dark:border-border-dark">
        {profile.canSpin ? (
          <View className="items-center gap-3">
            {profile.prizes.length > 0 && (
              <SpinWheel
                prizes={profile.prizes}
                targetIndex={wheelTargetIndex}
                spinToken={spinToken}
                onSpinEnd={handleWheelSpinEnd}
                size={150}
              />
            )}
            <Pressable
              onPress={handleSpin}
              disabled={spinning}
              className="w-full flex-row items-center justify-center gap-2 rounded-xl bg-primary py-2.5"
              style={{ opacity: spinning ? 0.6 : 1 }}
            >
              <Ionicons name="sparkles" size={16} color="#1C1C1E" />
              <Text className="text-sm font-medium text-primary-foreground dark:text-primary-foreground-dark">
                {spinning ? "Girando..." : "Girar Roleta Semanal"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="items-center gap-1">
            <Text className="text-center text-xs text-muted-foreground dark:text-muted-foreground-dark">
              Mantenha {profile.spinUnlockStreak} dias seguidos registrando transações pra desbloquear a Roleta Semanal.
            </Text>
            <Pressable onPress={() => router.push("/rewards")}>
              <Text className="text-xs font-medium text-primary underline">Ou compre um giro com pontos</Text>
            </Pressable>
          </View>
        )}
        {error && <Text className="mt-2 text-center text-xs text-destructive">{error}</Text>}
      </View>

      <Modal visible={prize !== null} transparent animationType="fade" onRequestClose={() => setPrize(null)}>
        <View className="flex-1 items-center justify-center bg-black/40 p-6">
          <View className="relative w-full max-w-xs items-center overflow-hidden rounded-2xl border border-border bg-card p-8 dark:border-border-dark dark:bg-card-dark">
            <ConfettiBurst />
            <Ionicons name="sparkles" size={32} color={colors.primary} />
            <Text className="mt-3 text-center text-lg font-bold text-foreground dark:text-foreground-dark">
              {prize?.label}
            </Text>
            <Text className="mt-1 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
              +{prize?.points} pontos! Volta semana que vem pra girar de novo.
            </Text>
            <Pressable
              onPress={() => setPrize(null)}
              className="mt-5 w-full rounded-xl bg-primary py-2.5"
            >
              <Text className="text-center text-sm font-medium text-primary-foreground dark:text-primary-foreground-dark">
                Fechar
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
