import "../global.css";
// O `fetch` global do Expo (SDK 56+) usa o Blob nativo do React Native em
// Response.blob(), que copia a resposta pro blob store nativo e lê de volta
// via base64 — lento, e o próprio Expo avisa pra usar o expo-blob. Substitui
// o Blob global aqui, uma vez, na inicialização — daí todo `fetch(...).blob()`
// existente no app (import de extrato, leitura de cupom fiscal) já se beneficia
// sem precisar mudar cada chamada.
import { Blob as ExpoBlob } from "expo-blob";
// @ts-expect-error -- expo-blob substitui o Blob nativo do RN globalmente.
globalThis.Blob = ExpoBlob;
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { useSession } from "@/lib/auth-client";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { registerPushToken } from "@/lib/push";
import { routeFromPushData } from "@/lib/notification-links";

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

  // Registra o aparelho pra push e trata o toque no aviso. Depende da sessão:
  // o token é gravado por usuário, então registrar antes do login o atribuiria
  // à conta errada.
  useEffect(() => {
    if (!session) return;
    void registerPushToken();

    // Tocar no aviso abre a tela do assunto, não só o app.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = routeFromPushData(response.notification.request.content.data);
      if (route) router.push(route as never);
    });
    return () => subscription.remove();
  }, [session, router]);

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
        <Stack.Screen
          name="assistant-agents"
          options={{ ...stackHeaderOptions, title: "Agentes" }}
        />
        <Stack.Screen
          name="notifications"
          options={{ ...stackHeaderOptions, title: "Notificações" }}
        />
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
