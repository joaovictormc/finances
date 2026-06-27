import { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { api } from "@/lib/api-client";
import { IconBadge } from "@/components/icon-badge";
import type { FinancialAccount } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  checking: "Conta Corrente",
  savings: "Poupança",
  credit_card: "Cartão de Crédito",
  investment: "Investimento",
  wallet: "Carteira",
};

const TYPE_ICONS: Record<string, string> = {
  checking: "🏦",
  savings: "🐷",
  credit_card: "💳",
  investment: "📈",
  wallet: "👛",
};

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      api
        .get<FinancialAccount[]>("/api/accounts")
        .then(setAccounts)
        .finally(() => setLoading(false));
    }, [])
  );

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <View className="flex-row items-center justify-between border-b border-border p-4 dark:border-border-dark">
        <Text className="text-2xl font-bold text-foreground dark:text-foreground-dark">Contas</Text>
        <Pressable
          onPress={() => router.push("/new-account")}
          className="rounded-md bg-primary px-3 py-2 dark:bg-primary-dark"
        >
          <Text className="text-sm font-medium text-primary-foreground dark:text-primary-foreground-dark">
            + Nova Conta
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            <Text className="p-6 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
              Nenhuma conta cadastrada.
            </Text>
          }
          renderItem={({ item: a }) => (
            <View className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4 dark:border-border-dark dark:bg-card-dark">
              <IconBadge icon={TYPE_ICONS[a.type] ?? "🏦"} color={a.color} />
              <View>
                <Text className="font-semibold text-foreground dark:text-foreground-dark">{a.name}</Text>
                <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                  {TYPE_LABELS[a.type] ?? a.type}
                  {a.institution ? ` · ${a.institution}` : ""}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
