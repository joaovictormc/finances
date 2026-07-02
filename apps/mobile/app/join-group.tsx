import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";

export default function JoinGroupScreen() {
  const { colors } = useTheme();
  const { code: codeParam } = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(codeParam ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!code.trim()) {
      setError("Informe o código de convite.");
      return;
    }

    setSaving(true);
    try {
      const group = await api.post<{ id: string; name: string }>(
        `/api/groups/join/${encodeURIComponent(code.trim())}`,
        {}
      );
      router.replace({ pathname: "/group-detail", params: { id: group.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar no grupo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-background p-4 dark:bg-background-dark">
      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">
        Código de convite
      </Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="Cole ou digite o código"
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        value={code}
        onChangeText={setCode}
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
          <Text className="font-medium text-primary-foreground dark:text-primary-foreground-dark">Entrar no grupo</Text>
        )}
      </Pressable>
    </View>
  );
}
