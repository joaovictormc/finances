import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSession } from "@/lib/auth-client";
import { ThemeProvider, useTheme } from "@/lib/theme";

function RootNavigator() {
  const { data: session, isPending } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const { scheme, colors } = useTheme();

  useEffect(() => {
    if (isPending) return;
    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, isPending, segments, router]);

  if (isPending) {
    return (
      <View
        className="flex-1 items-center justify-center bg-background dark:bg-background-dark"
        style={{ backgroundColor: colors.background }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  // Header nativo precisa de cores explícitas pra acompanhar o tema.
  const themedHeader = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.card },
    headerTitleStyle: { color: colors.foreground },
    headerTintColor: colors.foreground,
  } as const;
  const modalHeaderOptions = { ...themedHeader, presentation: "modal" as const };
  const stackHeaderOptions = themedHeader;

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="new-transaction"
          options={{ ...modalHeaderOptions, title: "Nova Transação" }}
        />
        <Stack.Screen
          name="new-account"
          options={{ ...modalHeaderOptions, title: "Nova Conta" }}
        />
        <Stack.Screen name="bills" options={{ ...stackHeaderOptions, title: "Contas a Pagar" }} />
        <Stack.Screen name="goals" options={{ ...stackHeaderOptions, title: "Metas" }} />
        <Stack.Screen name="budgets" options={{ ...stackHeaderOptions, title: "Orçamentos" }} />
        <Stack.Screen name="new-budget" options={{ ...modalHeaderOptions, title: "Novo Orçamento" }} />
        <Stack.Screen name="edit-transaction" options={{ ...modalHeaderOptions, title: "Editar Transação" }} />
        <Stack.Screen name="edit-account" options={{ ...modalHeaderOptions, title: "Editar Conta" }} />
        <Stack.Screen name="edit-bill" options={{ ...modalHeaderOptions, title: "Editar Conta Recorrente" }} />
        <Stack.Screen name="edit-goal" options={{ ...modalHeaderOptions, title: "Editar Meta" }} />
        <Stack.Screen name="edit-budget" options={{ ...modalHeaderOptions, title: "Editar Orçamento" }} />
        <Stack.Screen
          name="new-bill"
          options={{ ...modalHeaderOptions, title: "Nova Conta" }}
        />
        <Stack.Screen
          name="new-goal"
          options={{ ...modalHeaderOptions, title: "Nova Meta" }}
        />
        <Stack.Screen
          name="add-savings"
          options={{ ...modalHeaderOptions, title: "Adicionar ao poupado" }}
        />
        <Stack.Screen name="rewards" options={{ ...stackHeaderOptions, title: "Recompensas" }} />
        <Stack.Screen name="groups" options={{ ...stackHeaderOptions, title: "Grupos" }} />
        <Stack.Screen name="group-detail" options={{ ...stackHeaderOptions, title: "Grupo" }} />
        <Stack.Screen name="new-group" options={{ ...modalHeaderOptions, title: "Novo Grupo" }} />
        <Stack.Screen name="join-group" options={{ ...modalHeaderOptions, title: "Entrar com código" }} />
        <Stack.Screen name="settings" options={{ ...stackHeaderOptions, title: "Configurações" }} />
        <Stack.Screen name="billing" options={{ ...stackHeaderOptions, title: "Planos e Assinatura" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}
