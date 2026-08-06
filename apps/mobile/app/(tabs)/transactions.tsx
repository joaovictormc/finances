import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api-client";
import { Screen } from "@/components/screen";
import { useTheme } from "@/lib/theme";
import { formatBRL } from "@/lib/format";
import { PAYMENT_METHOD_BADGE } from "@/lib/payment-methods";
import type { Transaction, PaginatedResponse } from "@/lib/types";

function formatShortDate(date: string) {
  const d = new Date(date);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const TYPE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "income", label: "Receitas" },
  { value: "expense", label: "Gastos" },
  { value: "transfer", label: "Transferências" },
];

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (pageToLoad: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const res = await api.get<PaginatedResponse<Transaction>>("/api/transactions", {
        page: pageToLoad,
        limit: 20,
        ...(search && { search }),
        ...(type && { type }),
      });
      setTransactions((prev) => (append ? [...prev, ...res.data] : res.data));
      setPage(res.meta.page);
      setTotalPages(res.meta.totalPages);
    } catch {
      // mantém a lista atual em caso de erro
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, type]);

  useFocusEffect(
    useCallback(() => {
      load(1, false);
    }, [load])
  );

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(1, false), 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, type]);

  const handleEndReached = () => {
    if (loadingMore || page >= totalPages) return;
    load(page + 1, true);
  };

  return (
    <Screen>
      <View className="gap-3 px-4 pb-3 pt-2">
        <Text className="text-2xl font-bold text-foreground dark:text-foreground-dark">Transações</Text>
        <View className="flex-row items-center gap-2 rounded-2xl bg-card px-3 dark:bg-card-dark">
          <Ionicons name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            className="flex-1 py-3 text-foreground dark:text-foreground-dark"
            placeholder="Buscar transações..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <View className="flex-row flex-wrap gap-2">
          {TYPE_OPTIONS.map((opt) => {
            const active = type === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setType(opt.value)}
                className={`rounded-full px-3 py-1.5 ${active ? "bg-primary" : "bg-muted dark:bg-muted-dark"}`}
              >
                <Text
                  className={`text-xs font-semibold ${active ? "text-primary-foreground" : "text-muted-foreground dark:text-muted-foreground-dark"}`}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <Text className="p-6 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
              Nenhuma transação encontrada.
            </Text>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator className="py-4" color={colors.primary} /> : null}
          renderItem={({ item: t }) => {
            const isIncome = t.type === "income";
            const isExpense = t.type === "expense";
            return (
              <Pressable
                onPress={() => router.push({ pathname: "/edit-transaction", params: { id: t.id } })}
                className="flex-row items-center gap-3 border-b border-border py-3 dark:border-border-dark"
              >
                <View
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: isIncome
                      ? "rgba(37,99,235,0.14)"
                      : isExpense
                        ? "rgba(220,38,38,0.14)"
                        : "rgba(28,28,30,0.06)",
                  }}
                >
                  <Ionicons
                    name={isIncome ? "arrow-down" : isExpense ? "arrow-up" : "swap-horizontal"}
                    size={18}
                    color={isIncome ? colors.success : isExpense ? colors.destructive : colors.mutedForeground}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">{t.description}</Text>
                  <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                    {t.category?.name ?? "Sem categoria"} · {formatShortDate(t.date)}
                    {t.paymentMethod && PAYMENT_METHOD_BADGE[t.paymentMethod] ? ` · ${PAYMENT_METHOD_BADGE[t.paymentMethod]}` : ""}
                  </Text>
                </View>
                <Text
                  className="text-sm font-bold"
                  style={{ color: isIncome ? colors.success : isExpense ? colors.destructive : colors.mutedForeground }}
                >
                  {isExpense ? "-" : isIncome ? "+" : ""}
                  {formatBRL(Number(t.amount))}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}
