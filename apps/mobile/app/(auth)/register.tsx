import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Link, router } from "expo-router";
import { signUp } from "@/lib/auth-client";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    const { error } = await signUp.email({ name, email, password });
    setLoading(false);

    if (error) {
      setError(error.message ?? "Não foi possível criar a conta. Tente novamente.");
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
        Criar conta
      </Text>

      <TextInput
        className="mb-3 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="Nome"
        autoComplete="name"
        value={name}
        onChangeText={setName}
      />
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
        autoComplete="new-password"
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
          <Text className="font-medium text-primary-foreground dark:text-primary-foreground-dark">Criar conta</Text>
        )}
      </Pressable>

      <Link href="/(auth)/login" asChild>
        <Pressable className="mt-6">
          <Text className="text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
            Já tem conta? <Text className="font-medium text-primary dark:text-primary-dark">Entrar</Text>
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
