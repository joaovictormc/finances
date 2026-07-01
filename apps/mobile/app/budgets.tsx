import { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api-client";
import { IconBadge } from "@/components/icon-badge";
import { ProgressBar } from "@/components/progress-bar";
import { useTheme } from "@/lib/theme";
import { formatBRL } from "@/lib/format";
import type { Budget } from "@/lib/types";

function barColor(b: Budget): string {
  if (b.isOverBudget) return "#ef4444";
  if (b.isNearLimit) return "#f59e0b";
  return "#FEDC33";
}

export default function BudgetsScreen() {
  const { colors } = useTheme();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      api
        .get<Budget[]>("/api/budgets")
        .then(setBudgets)
        .finally(() => setLoading(false));
    }, [])
  );

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <View className="flex-row justify-end p-4">
        <Pressable
          onPress={() => router.push("/new-budget")}
          className="flex-row items-center gap-1 rounded-full bg-primary px-3 py-2"
        >
          <Ionicons name="add" size={16} color="#14142B" />
          <Text className="text-sm font-semibold text-primary-foreground">Novo Orçamento</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={budgets}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12 }}
          ListEmptyComponent={
            <Text className="p-6 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
              Nenhum orçamento cadastrado.
            </Text>
          }
          renderItem={({ item: b }) => {
            const spent = b.spentAmount;
            const limit = Number(b.amount);
            return (
              <Pressable
                onPress={() => router.push({ pathname: "/edit-budget", params: { id: b.id } })}
                className="gap-3 rounded-2xl border border-border bg-card p-4 dark:border-border-dark dark:bg-card-dark"
              >
                <View className="flex-row items-center gap-3">
                  <IconBadge icon={b.category?.icon ?? "📊"} />
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground dark:text-foreground-dark">{b.name}</Text>
                    <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                      {b.category?.name ?? "Geral"}
                    </Text>
                  </View>
                  <Text
                    className="text-sm font-bold"
                    style={{ color: b.isOverBudget ? "#ef4444" : colors.foreground }}
                  >
                    {Math.round(b.percentage * 100)}%
                  </Text>
                </View>
                <ProgressBar value={b.percentage} color={barColor(b)} />
                <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                  {formatBRL(spent)} de {formatBRL(limit)}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
