import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";
import { formatBRL } from "@/lib/format";

export default function AddSavingsScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ goalId?: string; current?: string }>();
  const currentAmount = Number(params.current ?? 0);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!params.goalId) {
      setError("Meta inválida.");
      return;
    }
    const value = Number(amount.replace(",", "."));
    if (!value || value <= 0) {
      setError("Informe um valor válido.");
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/api/goals/${params.goalId}`, {
        currentAmount: currentAmount + value,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark" contentContainerStyle={{ padding: 16 }}>
      <Text className="mb-4 text-sm text-muted-foreground dark:text-muted-foreground-dark">
        Poupado atualmente: {formatBRL(currentAmount)}
      </Text>

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Valor a adicionar</Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="0,00"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="decimal-pad"
        autoFocus
        value={amount}
        onChangeText={setAmount}
      />

      {error && <Text className="mb-3 text-sm text-destructive dark:text-destructive-dark">{error}</Text>}

      <Pressable
        onPress={handleSubmit}
        disabled={saving}
        className="items-center rounded-md bg-primary py-3 dark:bg-primary-dark"
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-medium text-primary-foreground dark:text-primary-foreground-dark">Adicionar</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
