import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { authClient } from "@/lib/auth-client";
import { useTheme } from "@/lib/theme";

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const { error } = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: Linking.createURL("/reset-password"),
      });
      if (error) {
        setError(error.message ?? "Não foi possível enviar o e-mail. Tente novamente.");
        return;
      }
      setSent(true);
    } catch {
      setError("Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <View className="flex-1 justify-center bg-background dark:bg-background-dark px-6">
        <View className="mb-4 items-center">
          <Ionicons name="mail-outline" size={40} color={colors.primary} />
        </View>
        <Text className="mb-1 text-center text-lg font-semibold text-foreground dark:text-foreground-dark">
          Verifique seu e-mail
        </Text>
        <Text className="mb-8 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
          Se existir uma conta com o e-mail {email}, enviamos um link pra redefinir a senha. Confira
          sua caixa de entrada.
        </Text>
        <Link href="/(auth)/login" asChild>
          <Pressable>
            <Text className="text-center text-sm font-medium text-primary dark:text-primary-dark">
              Voltar para o login
            </Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center bg-background dark:bg-background-dark px-6">
      <Text className="mb-1 text-center text-2xl font-bold text-foreground dark:text-foreground-dark">
        Esqueceu sua senha?
      </Text>
      <Text className="mb-8 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
        Digite seu e-mail e enviaremos um link pra redefinir sua senha.
      </Text>

      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="E-mail"
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {error && <Text className="mb-3 text-sm text-destructive dark:text-destructive-dark">{error}</Text>}

      <Pressable
        onPress={handleSubmit}
        disabled={loading}
        className="items-center rounded-md bg-primary py-3 dark:bg-primary-dark"
      >
        {loading ? (
          <ActivityIndicator color="#14142B" />
        ) : (
          <Text className="font-medium text-primary-foreground dark:text-primary-foreground-dark">
            Enviar link de redefinição
          </Text>
        )}
      </Pressable>

      <Link href="/(auth)/login" asChild>
        <Pressable className="mt-6">
          <Text className="text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
            Voltar para o login
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
