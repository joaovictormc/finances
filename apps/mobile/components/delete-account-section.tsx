import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { authClient } from "@/lib/auth-client";
import { useTheme } from "@/lib/theme";

export function DeleteAccountSection() {
  const { colors } = useTheme();
  const [step, setStep] = useState<"idle" | "confirm">("idle");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!password) return;
    setError(null);
    setLoading(true);
    const { error } = await authClient.deleteUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Senha incorreta.");
      return;
    }
    router.replace("/(auth)/login");
  }

  if (step === "confirm") {
    return (
      <View className="gap-3">
        <Text className="text-sm text-destructive dark:text-destructive-dark">
          Isso vai apagar permanentemente sua conta e todos os seus dados (transações, contas,
          metas, orçamentos, etc). Essa ação não pode ser desfeita.
        </Text>
        <TextInput
          className="rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
          placeholder="Confirme sua senha"
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error && <Text className="text-sm text-destructive dark:text-destructive-dark">{error}</Text>}
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => setStep("idle")}
            className="flex-1 items-center rounded-md border border-border py-3 dark:border-border-dark"
          >
            <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">Cancelar</Text>
          </Pressable>
          <Pressable
            onPress={handleDelete}
            disabled={loading}
            className="flex-1 items-center rounded-md bg-destructive py-3"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-sm font-medium text-white">Excluir minha conta</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => setStep("confirm")}
      className="items-center rounded-md border border-destructive py-3"
    >
      <Text className="text-sm font-medium text-destructive dark:text-destructive-dark">Excluir minha conta</Text>
    </Pressable>
  );
}
