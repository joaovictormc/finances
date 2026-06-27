import { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PieChart } from "react-native-gifted-charts";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import { useTheme } from "@/lib/theme";
import { formatBRL } from "@/lib/format";
import type { MonthlyReport, Transaction, PaginatedResponse } from "@/lib/types";

// Paleta de fatias no espírito Finans: amarelo de marca primeiro, depois apoios.
const SLICE_COLORS = ["#FEDC33", "#14142B", "#22c55e", "#95A4B7", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function initials(name?: string | null) {
  if (!name) return "•";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export default function OverviewScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: session } = useSession();
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const now = new Date();
      const [reportData, recentData] = await Promise.all([
        api.get<MonthlyReport>("/api/transactions/reports/monthly", {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        }),
        api.get<PaginatedResponse<Transaction>>("/api/transactions", { page: 1, limit: 5 }),
      ]);
      setReport(reportData);
      setRecent(recentData.data);
    } catch {
      // mantém a tela com os dados já carregados se a request falhar
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const income = report?.income ?? 0;
  const expense = report?.expense ?? 0;
  const balance = report?.balance ?? income - expense;
  const monthLabel = `${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`;

  const pieData = (report?.byCategory ?? [])
    .filter((row) => row.total > 0)
    .slice(0, 8)
    .map((row, i) => ({ value: row.total, color: SLICE_COLORS[i % SLICE_COLORS.length] }));

  return (
    <ScrollView
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: 96 }}
    >
      {/* Header: saudação + perfil */}
      <View className="mb-5 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-base font-bold text-navy">{initials(session?.user?.name)}</Text>
          </View>
          <View>
            <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">Bem-vindo,</Text>
            <Text className="text-base font-semibold text-foreground dark:text-foreground-dark">
              {session?.user?.name ?? "Você"}
            </Text>
          </View>
        </View>
        <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-card dark:bg-card-dark">
          <Ionicons name="notifications-outline" size={20} color={colors.foreground} />
        </Pressable>
      </View>

      {/* Hero card: saldo do mês */}
      <View className="mb-4 rounded-3xl p-5" style={{ backgroundColor: "#14142B" }}>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-medium" style={{ color: "#95A4B7" }}>
            Saldo do mês
          </Text>
          <View className="rounded-full px-3 py-1" style={{ backgroundColor: "rgba(254,220,51,0.16)" }}>
            <Text className="text-[11px] font-semibold" style={{ color: "#FEDC33" }}>
              {monthLabel}
            </Text>
          </View>
        </View>
        <Text className="mt-2 text-3xl font-bold text-white">{formatBRL(balance)}</Text>

        <View className="mt-5 flex-row gap-3">
          <View className="flex-1 flex-row items-center gap-2 rounded-2xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
            <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(34,197,94,0.18)" }}>
              <Ionicons name="arrow-down" size={16} color="#22c55e" />
            </View>
            <View>
              <Text className="text-[11px]" style={{ color: "#95A4B7" }}>Receitas</Text>
              <Text className="text-sm font-semibold text-white">{formatBRL(income)}</Text>
            </View>
          </View>
          <View className="flex-1 flex-row items-center gap-2 rounded-2xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
            <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(239,68,68,0.18)" }}>
              <Ionicons name="arrow-up" size={16} color="#ef4444" />
            </View>
            <View>
              <Text className="text-[11px]" style={{ color: "#95A4B7" }}>Gastos</Text>
              <Text className="text-sm font-semibold text-white">{formatBRL(expense)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Gastos por categoria */}
      <View className="mb-4 items-center rounded-3xl border border-border bg-card p-5 dark:border-border-dark dark:bg-card-dark">
        <Text className="mb-3 self-start text-base font-semibold text-foreground dark:text-foreground-dark">
          Gastos por categoria
        </Text>
        {pieData.length > 0 ? (
          <PieChart data={pieData} donut radius={80} innerRadius={52} innerCircleColor={colors.card} />
        ) : (
          <Text className="py-6 text-sm text-muted-foreground dark:text-muted-foreground-dark">
            Sem gastos neste mês
          </Text>
        )}
      </View>

      {/* Movimentações recentes */}
      <View className="rounded-3xl border border-border bg-card p-5 dark:border-border-dark dark:bg-card-dark">
        <Text className="mb-1 text-base font-semibold text-foreground dark:text-foreground-dark">
          Movimentações recentes
        </Text>
        {recent.length === 0 ? (
          <Text className="py-4 text-sm text-muted-foreground dark:text-muted-foreground-dark">
            Nenhuma transação ainda.
          </Text>
        ) : (
          recent.map((t, idx) => {
            const isIncome = t.type === "income";
            const isExpense = t.type === "expense";
            const amountColor = isIncome ? "#22c55e" : isExpense ? "#14142B" : "#95A4B7";
            return (
              <View
                key={t.id}
                className={`flex-row items-center gap-3 py-3 ${idx > 0 ? "border-t border-border dark:border-border-dark" : ""}`}
              >
                <View
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: isIncome ? "rgba(34,197,94,0.14)" : "rgba(20,20,43,0.06)" }}
                >
                  <Ionicons
                    name={isIncome ? "arrow-down" : isExpense ? "arrow-up" : "swap-horizontal"}
                    size={18}
                    color={isIncome ? "#22c55e" : colors.foreground}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">{t.description}</Text>
                  <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                    {t.category?.name ?? "Sem categoria"}
                  </Text>
                </View>
                <Text className="text-sm font-bold" style={{ color: amountColor }}>
                  {isExpense ? "-" : isIncome ? "+" : ""}
                  {formatBRL(Number(t.amount))}
                </Text>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
