import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { api } from "@/lib/api-client";
import { DateField } from "@/components/date-field";
import { useTheme } from "@/lib/theme";
import type { Group } from "@/lib/types";

export default function NewGoalScreen() {
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [groupId, setGroupId] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Group[]>("/api/groups").then(setGroups).catch(() => {});
  }, []);

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError("Informe o nome da meta.");
      return;
    }
    const target = Number(targetAmount.replace(",", "."));
    if (!target || target <= 0) {
      setError("Informe um valor alvo válido.");
      return;
    }
    const current = currentAmount ? Number(currentAmount.replace(",", ".")) : 0;
    if (Number.isNaN(current) || current < 0) {
      setError("Valor poupado inválido.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/api/goals", {
        name: name.trim(),
        description: description.trim() || undefined,
        targetAmount: target,
        currentAmount: current,
        targetDate: targetDate || undefined,
        groupId: groupId || undefined,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar meta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark" contentContainerStyle={{ padding: 16 }}>
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

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Valor já poupado (opcional)</Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="0,00"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="decimal-pad"
        value={currentAmount}
        onChangeText={setCurrentAmount}
      />

      <DateField label="Prazo (opcional)" value={targetDate} onChange={setTargetDate} />

      {groups.length > 0 && (
        <>
          <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Compartilhar com</Text>
          <View className="mb-4 flex-row flex-wrap gap-2">
            <Pressable
              onPress={() => setGroupId("")}
              className={`rounded-full border px-3 py-1.5 ${!groupId ? "border-primary bg-primary/10 dark:border-primary-dark" : "border-border dark:border-border-dark"}`}
            >
              <Text className="text-xs font-medium text-foreground dark:text-foreground-dark">Pessoal</Text>
            </Pressable>
            {groups.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => setGroupId(g.id)}
                className={`rounded-full border px-3 py-1.5 ${groupId === g.id ? "border-primary bg-primary/10 dark:border-primary-dark" : "border-border dark:border-border-dark"}`}
              >
                <Text className="text-xs font-medium text-foreground dark:text-foreground-dark">{g.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {error && <Text className="mb-3 text-sm text-destructive dark:text-destructive-dark">{error}</Text>}

      <Pressable
        onPress={handleSubmit}
        disabled={saving}
        className="items-center rounded-md bg-primary py-3 dark:bg-primary-dark"
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-medium text-primary-foreground dark:text-primary-foreground-dark">Salvar</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
