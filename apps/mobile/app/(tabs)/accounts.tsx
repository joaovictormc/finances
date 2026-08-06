import { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api-client";
import { Screen } from "@/components/screen";
import { IconBadge } from "@/components/icon-badge";
import { useTheme } from "@/lib/theme";
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
  const { colors } = useTheme();
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
    <Screen>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <Text className="text-2xl font-bold text-foreground dark:text-foreground-dark">Contas</Text>
        <Pressable
          onPress={() => router.push("/new-account")}
          className="flex-row items-center gap-1 rounded-full bg-primary px-3 py-2"
        >
          <Ionicons name="add" size={16} color="#1C1C1E" />
          <Text className="text-sm font-semibold text-primary-foreground">Nova Conta</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
          ListEmptyComponent={
            <Text className="p-6 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
              Nenhuma conta cadastrada.
            </Text>
          }
          renderItem={({ item: a }) => (
            <Pressable
              onPress={() => router.push({ pathname: "/edit-account", params: { id: a.id } })}
              className="flex-row items-center gap-3 rounded-2xl border border-border bg-card p-4 dark:border-border-dark dark:bg-card-dark"
            >
              <IconBadge icon={TYPE_ICONS[a.type] ?? "🏦"} color={a.color} />
              <View className="flex-1">
                <Text className="font-semibold text-foreground dark:text-foreground-dark">{a.name}</Text>
                <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                  {TYPE_LABELS[a.type] ?? a.type}
                  {a.institution ? ` · ${a.institution}` : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
