import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { api } from "@/lib/api-client";
import { IconBadge } from "@/components/icon-badge";
import type { Transaction, PaginatedResponse } from "@/lib/types";

function formatBRL(value: number) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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
    <View className="flex-1 bg-background dark:bg-background-dark">
      <View className="gap-2 border-b border-border p-4 dark:border-border-dark">
        <View className="flex-row items-center gap-2">
          <TextInput
            className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
            placeholder="Buscar transações..."
            value={search}
            onChangeText={setSearch}
          />
          <Pressable
            onPress={() => router.push("/new-transaction")}
            className="h-10 w-10 items-center justify-center rounded-md bg-primary dark:bg-primary-dark"
          >
            <Text className="text-lg font-bold text-primary-foreground dark:text-primary-foreground-dark">+</Text>
          </Pressable>
        </View>
        <View className="flex-row gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setType(opt.value)}
              className={`rounded-full px-3 py-1.5 ${type === opt.value ? "bg-primary dark:bg-primary-dark" : "bg-muted dark:bg-muted-dark"}`}
            >
              <Text
                className={`text-xs font-medium ${type === opt.value ? "text-primary-foreground dark:text-primary-foreground-dark" : "text-muted-foreground dark:text-muted-foreground-dark"}`}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(t) => t.id}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <Text className="p-6 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
              Nenhuma transação encontrada.
            </Text>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator className="py-4" /> : null}
          renderItem={({ item: t }) => (
            <View className="flex-row items-center gap-3 border-b border-border px-4 py-3 dark:border-border-dark">
              <IconBadge icon={t.category?.icon} color={t.category?.color} size="sm" />
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">{t.description}</Text>
                <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                  {t.category?.name ?? "Sem categoria"} · {formatShortDate(t.date)}
                </Text>
              </View>
              <Text
                className="text-sm font-semibold"
                style={{ color: t.type === "income" ? "#22c55e" : t.type === "expense" ? "#ef4444" : "#6366f1" }}
              >
                {t.type === "expense" ? "-" : t.type === "income" ? "+" : ""}
                {formatBRL(Number(t.amount))}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
