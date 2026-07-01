import { useEffect, useState } from "react";
import { Alert, View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";
import type { Goal } from "@/lib/types";

export default function EditGoalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Goal[]>("/api/goals")
      .then((goals) => {
        const goal = goals.find((g) => g.id === id);
        if (goal) {
          setName(goal.name);
          setDescription(goal.description ?? "");
          setTargetAmount(String(Number(goal.targetAmount)));
          setTargetDate(goal.targetDate ? goal.targetDate.slice(0, 10) : "");
        } else {
          setError("Meta não encontrada.");
        }
      })
      .catch(() => setError("Erro ao carregar meta."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    setError(null);
    if (!name.trim()) { setError("Informe o nome da meta."); return; }
    const target = Number(targetAmount.replace(",", "."));
    if (!target || target <= 0) { setError("Valor alvo inválido."); return; }
    setSaving(true);
    try {
      await api.patch(`/api/goals/${id}`, {
        name: name.trim(),
        description: description.trim() || undefined,
        targetAmount: target,
        targetDate: targetDate || undefined,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert("Excluir meta", "Esta ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await api.delete(`/api/goals/${id}`);
            router.back();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao excluir.");
            setDeleting(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerStyle={{ padding: 16 }}
    >
      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Nome</Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="Ex: Viagem, Fundo de emergência"
        placeholderTextColor={colors.mutedForeground}
        value={name}
        onChangeText={setName}
      />

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Descrição (opcional)</Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="Detalhes sobre a meta..."
        placeholderTextColor={colors.mutedForeground}
        value={description}
        onChangeText={setDescription}
      />

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Valor alvo</Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="0,00"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="decimal-pad"
        value={targetAmount}
        onChangeText={setTargetAmount}
      />

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Prazo (AAAA-MM-DD, opcional)</Text>
      <TextInput
        className="mb-6 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="2026-12-31"
        placeholderTextColor={colors.mutedForeground}
        value={targetDate}
        onChangeText={setTargetDate}
      />

      {error && <Text className="mb-3 text-sm text-destructive dark:text-destructive-dark">{error}</Text>}

      <Pressable
        onPress={handleSave}
        disabled={saving || deleting}
        className="mb-3 items-center rounded-md bg-primary py-3"
      >
        {saving ? (
          <ActivityIndicator color="#14142B" />
        ) : (
          <Text className="font-semibold text-primary-foreground">Salvar alterações</Text>
        )}
      </Pressable>

      <Pressable
        onPress={confirmDelete}
        disabled={saving || deleting}
        className="items-center rounded-md border border-destructive py-3"
      >
        {deleting ? (
          <ActivityIndicator color="#ef4444" />
        ) : (
          <Text className="font-medium text-destructive dark:text-destructive-dark">Excluir meta</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
