import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { authClient } from "@/lib/auth-client";
import { useTheme } from "@/lib/theme";
import { PasswordInput } from "@/components/password-input";
import { PasswordStrengthMeter } from "@/components/password-strength-meter";
import { PasswordPolicySchema } from "@finances/validations";

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const { token, error: tokenError } = useLocalSearchParams<{ token?: string; error?: string }>();

  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);

    if (!token) {
      setError("Link inválido ou expirado. Peça um novo link de redefinição.");
      return;
    }

    const passwordCheck = PasswordPolicySchema.safeParse(password);
    if (!passwordCheck.success) {
      setError(passwordCheck.error.issues[0]?.message ?? "Senha inválida.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await authClient.resetPassword({ newPassword: password, token });
      if (error) {
        setError(error.message ?? "Não foi possível redefinir a senha. Peça um novo link.");
        return;
      }
      setDone(true);
    } catch {
      setError("Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (tokenError === "INVALID_TOKEN" || !token) {
    return (
      <View className="flex-1 justify-center bg-background dark:bg-background-dark px-6">
        <Text className="mb-1 text-center text-lg font-semibold text-foreground dark:text-foreground-dark">
          Link inválido ou expirado
        </Text>
        <Text className="mb-8 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
          Peça um novo link de redefinição de senha.
        </Text>
        <Link href="/(auth)/forgot-password" asChild>
          <Pressable>
            <Text className="text-center text-sm font-medium text-primary dark:text-primary-dark">
              Esqueci minha senha
            </Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  if (done) {
    return (
      <View className="flex-1 justify-center bg-background dark:bg-background-dark px-6">
        <View className="mb-4 items-center">
          <Ionicons name="checkmark-circle" size={40} color="#22c55e" />
        </View>
        <Text className="mb-1 text-center text-lg font-semibold text-foreground dark:text-foreground-dark">
          Senha redefinida!
        </Text>
        <Text className="mb-8 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
          Sua senha foi alterada com sucesso. Suas outras sessões ativas foram encerradas por
          segurança.
        </Text>
        <Pressable
          onPress={() => router.replace("/(auth)/login")}
          className="items-center rounded-md bg-primary py-3 dark:bg-primary-dark"
        >
          <Text className="font-medium text-primary-foreground dark:text-primary-foreground-dark">
            Ir para o login
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center bg-background dark:bg-background-dark px-6">
      <Text className="mb-8 text-center text-2xl font-bold text-foreground dark:text-foreground-dark">
        Escolha uma nova senha
      </Text>

      <PasswordInput
        className="mb-1"
        placeholder="Nova senha"
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
      />
      <PasswordStrengthMeter password={password} />

      {error && <Text className="mb-3 mt-3 text-sm text-destructive dark:text-destructive-dark">{error}</Text>}

      <Pressable
        onPress={handleSubmit}
        disabled={loading}
        className="mt-4 items-center rounded-md bg-primary py-3 dark:bg-primary-dark"
      >
        {loading ? (
          <ActivityIndicator color="#14142B" />
        ) : (
          <Text className="font-medium text-primary-foreground dark:text-primary-foreground-dark">
            Redefinir senha
          </Text>
        )}
      </Pressable>
    </View>
  );
}
