import { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { api } from "@/lib/api-client";
import { IconBadge } from "@/components/icon-badge";
import { ProgressBar } from "@/components/progress-bar";
import { formatBRL, formatDate, daysUntil } from "@/lib/format";
import type { Goal } from "@/lib/types";

function deadlineLabel(targetDate: string): string {
  const days = daysUntil(targetDate);
  if (days < 0) return `⚠ Prazo encerrado há ${Math.abs(days)} dias`;
  if (days === 0) return "🎯 Prazo é hoje!";
  return `📅 ${days} dias restantes — ${formatDate(targetDate)}`;
}

export default function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      api
        .get<Goal[]>("/api/goals")
        .then(setGoals)
        .finally(() => setLoading(false));
    }, [])
  );

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <View className="flex-row justify-end p-4">
        <Pressable
          onPress={() => router.push("/new-goal")}
          className="rounded-md bg-primary px-3 py-2 dark:bg-primary-dark"
        >
          <Text className="text-sm font-medium text-primary-foreground dark:text-primary-foreground-dark">
            + Nova Meta
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={goals}
          keyExtractor={(g) => g.id}
          contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12 }}
          ListEmptyComponent={
            <Text className="p-6 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
              Nenhuma meta criada.
            </Text>
          }
          renderItem={({ item: g }) => {
            const target = Number(g.targetAmount);
            const current = Number(g.currentAmount);
            const pct = target > 0 ? current / target : 0;
            return (
              <View className="rounded-xl border border-border bg-card p-4 dark:border-border-dark dark:bg-card-dark">
                <View className="mb-3 flex-row items-start gap-3">
                  <IconBadge icon={g.icon ?? "🎯"} color={g.color} />
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground dark:text-foreground-dark">{g.name}</Text>
                    {g.description ? (
                      <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                        {g.description}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <ProgressBar value={pct} color={g.color} />

                <View className="mt-2 flex-row justify-between">
                  <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
                    {formatBRL(current)} poupados
                  </Text>
                  <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
                    meta: {formatBRL(target)}
                  </Text>
                </View>

                {g.targetDate ? (
                  <Text className="mt-2 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                    {deadlineLabel(g.targetDate)}
                  </Text>
                ) : null}

                {g.isCompleted ? (
                  <Text className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    ✅ Meta concluída!
                  </Text>
                ) : (
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: "/add-savings", params: { goalId: g.id, current: g.currentAmount } })
                    }
                    className="mt-3 items-center rounded-md border border-primary py-2 dark:border-primary-dark"
                  >
                    <Text className="text-sm font-medium text-primary dark:text-primary-dark">+ Poupar</Text>
                  </Pressable>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
