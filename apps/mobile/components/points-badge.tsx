import { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";

/** Badge compacto com o total de pontos de gamificação — leva pra tela de recompensas. */
export function PointsBadge() {
  const { colors } = useTheme();
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<{ points: number }>("/api/gamification/profile")
      .then((p) => setPoints(p.points))
      .catch(() => setPoints(null));
  }, []);

  if (points === null) return null;

  return (
    <Pressable
      onPress={() => router.push("/rewards")}
      className="flex-row items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1.5"
    >
      <Ionicons name="sparkles" size={12} color={colors.primary} />
      <Text className="text-xs font-semibold text-primary">{points}</Text>
    </Pressable>
  );
}
