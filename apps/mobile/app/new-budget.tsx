import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";
import type { Category } from "@/lib/types";

const PERIOD_OPTIONS: { value: "monthly" | "weekly" | "yearly"; label: string }[] = [
  { value: "monthly", label: "Mensal" },
  { value: "weekly", label: "Semanal" },
  { value: "yearly", label: "Anual" },
];

// Primeiro dia do mês atual em YYYY-MM-DD (formato exigido pelo schema).
function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function NewBudgetScreen() {
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<"monthly" | "weekly" | "yearly">("monthly");
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Category[]>("/api/categories")
      .then((all) => setCategories(all.filter((c) => c.type === "expense")))
      .catch(() => setCategories([]));
  }, []);

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError("Informe o nome do orçamento.");
      return;
    }
    const numericAmount = Number(amount.replace(",", "."));
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError("Valor inválido.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/api/budgets", {
        name: name.trim(),
        amount: numericAmount,
        period,
        startDate: firstOfMonth(),
        ...(categoryId && { categoryId }),
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar orçamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark" contentContainerStyle={{ padding: 16 }}>
      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Nome</Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="Ex: Alimentação, Lazer"
        placeholderTextColor={colors.mutedForeground}
        value={name}
        onChangeText={setName}
      />

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Valor limite</Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="0,00"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Período</Text>
      <View className="mb-4 flex-row gap-2">
        {PERIOD_OPTIONS.map((opt) => {
          const active = period === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setPeriod(opt.value)}
              className={`rounded-full px-4 py-2 ${active ? "bg-primary" : "bg-muted dark:bg-muted-dark"}`}
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

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Categoria (opcional)</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        <Pressable
          onPress={() => setCategoryId(undefined)}
          className={`rounded-full border px-3 py-1.5 ${!categoryId ? "border-primary bg-primary/10" : "border-border dark:border-border-dark"}`}
        >
          <Text className="text-xs font-medium text-foreground dark:text-foreground-dark">Geral</Text>
        </Pressable>
        {categories.map((c) => {
          const active = categoryId === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCategoryId(c.id)}
              className={`rounded-full border px-3 py-1.5 ${active ? "border-primary bg-primary/10" : "border-border dark:border-border-dark"}`}
            >
              <Text className="text-xs font-medium text-foreground dark:text-foreground-dark">
                {c.icon ? `${c.icon} ` : ""}
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error && <Text className="mb-3 text-sm text-destructive dark:text-destructive-dark">{error}</Text>}

      <Pressable
        onPress={handleSubmit}
        disabled={saving}
        className="items-center rounded-md bg-primary py-3"
      >
        {saving ? (
          <ActivityIndicator color="#1C1C1E" />
        ) : (
          <Text className="font-semibold text-primary-foreground">Salvar</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
