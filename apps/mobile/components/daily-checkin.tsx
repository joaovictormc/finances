import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";

export type CheckinStatus = {
  /** Desligado pelo admin: o bloco some. */
  enabled: boolean;
  rewardDays: number;
  rewardPoints: number;
  /** Já zerada pela API se o usuário pulou um dia. */
  streak: number;
  checkedInToday: boolean;
};

export type CheckinResult = {
  streak: number;
  reward: number;
  points: number;
  level: number;
};

// Acima disso as barrinhas não cabem numa linha: vira barra contínua.
const MAX_DOTS = 10;

/**
 * Botão de check-in diário + progresso até a próxima recompensa. Mesma regra
 * do web (components/gamification/daily-checkin.tsx); aqui o pai guarda o
 * perfil e aplica o resultado via `onCheckedIn`.
 */
export function DailyCheckin({
  status,
  onCheckedIn,
}: {
  status: CheckinStatus;
  onCheckedIn: (result: CheckinResult) => void;
}) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  if (!status.enabled) return null;
  const { streak, checkedInToday, rewardDays, rewardPoints } = status;

  // No dia que fecha o ciclo o resto da divisão é 0, mas a barra tem que
  // aparecer cheia, não vazia.
  const inCycle = streak % rewardDays;
  const filled =
    checkedInToday && streak > 0 && inCycle === 0 ? rewardDays : inCycle;
  const daysLeft = rewardDays - filled;

  async function handleCheckin() {
    setLoading(true);
    setMessage(null);
    try {
      const result = await api.post<CheckinResult>(
        "/api/gamification/checkin",
        {},
      );
      onCheckedIn(result);
      setMessage({
        text:
          result.reward > 0
            ? `+${result.reward} pontos! ${result.streak} dias seguidos de check-in.`
            : `Check-in feito! ${result.streak} ${result.streak === 1 ? "dia" : "dias"} seguidos.`,
        error: false,
      });
    } catch (err) {
      setMessage({
        text:
          err instanceof Error
            ? err.message
            : "Não foi possível fazer o check-in.",
        error: true,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="calendar-outline" size={15} color={colors.primary} />
          <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">
            Check-in diário
          </Text>
        </View>
        <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
          {filled}/{rewardDays}
        </Text>
      </View>

      {rewardDays <= MAX_DOTS ? (
        <View className="mb-2 flex-row gap-1.5">
          {Array.from({ length: rewardDays }, (_, i) => (
            <View
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < filled ? "bg-primary" : "bg-muted dark:bg-muted-dark"}`}
            />
          ))}
        </View>
      ) : (
        <View className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted dark:bg-muted-dark">
          <View
            className="h-full rounded-full bg-primary"
            style={{ width: `${(filled / rewardDays) * 100}%` }}
          />
        </View>
      )}

      <Text className="mb-3 text-xs text-muted-foreground dark:text-muted-foreground-dark">
        {daysLeft === 0
          ? `Ciclo completo! Você ganhou ${rewardPoints} pontos.`
          : `Faltam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"} seguidos pra ganhar ${rewardPoints} pontos.`}
      </Text>

      <Pressable
        onPress={handleCheckin}
        disabled={checkedInToday || loading}
        className={`w-full flex-row items-center justify-center gap-2 rounded-xl py-2.5 ${
          checkedInToday ? "bg-muted dark:bg-muted-dark" : "bg-primary"
        }`}
        style={{ opacity: loading ? 0.6 : 1 }}
      >
        {checkedInToday && (
          <Ionicons name="checkmark" size={16} color={colors.mutedForeground} />
        )}
        <Text
          className={`text-sm font-medium ${
            checkedInToday
              ? "text-muted-foreground dark:text-muted-foreground-dark"
              : "text-primary-foreground dark:text-primary-foreground-dark"
          }`}
        >
          {checkedInToday
            ? "Check-in de hoje feito"
            : loading
              ? "Fazendo check-in..."
              : "Fazer check-in"}
        </Text>
      </Pressable>

      {message && (
        <Text
          className={`mt-2 text-center text-xs ${message.error ? "text-destructive" : "text-foreground dark:text-foreground-dark"}`}
        >
          {message.text}
        </Text>
      )}
    </View>
  );
}
