import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Link, router } from "expo-router";
import { signIn } from "@/lib/auth-client";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    const { error } = await signIn.email({ email, password });
    setLoading(false);

    if (error) {
      setError(
        error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "E-mail ou senha incorretos."
          : error.message ?? "Não foi possível entrar. Tente novamente."
      );
      return;
    }

    router.replace("/(tabs)");
  }

  return (
    <View className="flex-1 justify-center bg-background dark:bg-background-dark px-6">
      <Text className="mb-1 text-center text-2xl font-bold text-foreground dark:text-foreground-dark">
        Control<Text className="text-primary dark:text-primary-dark">AI</Text>
      </Text>
      <Text className="mb-8 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
        Entrar na sua conta
      </Text>

      <TextInput
        className="mb-3 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="E-mail"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="Senha"
        secureTextEntry
        autoComplete="current-password"
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text className="mb-3 text-sm text-destructive dark:text-destructive-dark">{error}</Text>}

      <Pressable
        onPress={handleSubmit}
        disabled={loading}
        className="items-center rounded-md bg-primary py-3 dark:bg-primary-dark"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-medium text-primary-foreground dark:text-primary-foreground-dark">Entrar</Text>
        )}
      </Pressable>

      <Link href="/(auth)/register" asChild>
        <Pressable className="mt-6">
          <Text className="text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
            Não tem conta? <Text className="font-medium text-primary dark:text-primary-dark">Criar conta</Text>
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
