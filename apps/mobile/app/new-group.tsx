import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";
import type { Group } from "@/lib/types";

export default function NewGroupScreen() {
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError("Informe o nome do grupo.");
      return;
    }

    setSaving(true);
    try {
      await api.post<Group>("/api/groups", { name: name.trim() });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar grupo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-background p-4 dark:bg-background-dark">
      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Nome do grupo</Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="Ex: Família, República"
        placeholderTextColor={colors.mutedForeground}
        value={name}
        onChangeText={setName}
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
          <Text className="font-medium text-primary-foreground dark:text-primary-foreground-dark">Criar grupo</Text>
        )}
      </Pressable>
    </View>
  );
}
