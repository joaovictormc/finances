import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";

type Status = { linked: boolean; telegramChatId: string | null };

export function TelegramLink() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Status>("/api/bots/telegram/status")
      .then((s) => setLinked(s.linked))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleLink() {
    if (!code.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/bots/telegram/link", { code: code.trim() });
      setLinked(true);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível vincular.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnlink() {
    setUnlinking(true);
    try {
      await api.delete("/api/bots/telegram/link");
      setLinked(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao desvincular.");
    } finally {
      setUnlinking(false);
    }
  }

  if (loading) {
    return <ActivityIndicator color={colors.primary} />;
  }

  if (linked) {
    return (
      <View className="gap-3">
        <View className="flex-row items-center gap-2 rounded-md bg-green-500/10 px-3 py-2">
          <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
          <Text className="text-sm font-medium text-green-600">Telegram vinculado</Text>
        </View>
        <Pressable
          onPress={handleUnlink}
          disabled={unlinking}
          className="items-center rounded-md border border-destructive py-3"
        >
          {unlinking ? (
            <ActivityIndicator color="#ef4444" />
          ) : (
            <Text className="text-sm font-medium text-destructive dark:text-destructive-dark">Desvincular</Text>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row gap-2">
        <TextInput
          className="flex-1 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
          placeholder="Código do Telegram"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="characters"
          maxLength={12}
          value={code}
          onChangeText={setCode}
        />
        <Pressable
          onPress={handleLink}
          disabled={submitting}
          className="items-center justify-center rounded-md bg-primary px-4 dark:bg-primary-dark"
        >
          {submitting ? (
            <ActivityIndicator color="#1C1C1E" />
          ) : (
            <Text className="text-sm font-medium text-primary-foreground dark:text-primary-foreground-dark">
              Vincular
            </Text>
          )}
        </Pressable>
      </View>
      {error && <Text className="text-sm text-destructive dark:text-destructive-dark">{error}</Text>}
      <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
        1. Abra o Telegram e busque nosso bot{"\n"}
        2. Envie /start{"\n"}
        3. Cole o código de 6 dígitos acima
      </Text>
    </View>
  );
}
