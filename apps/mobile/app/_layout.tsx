import "../global.css";
// O `fetch` global do Expo (SDK 56+) usa o Blob nativo do React Native em
// Response.blob(), que copia a resposta pro blob store nativo e lê de volta
// via base64 — lento, e o próprio Expo avisa pra usar o expo-blob. Substitui
// o Blob global aqui, uma vez, na inicialização — daí todo `fetch(...).blob()`
// existente no app (import de extrato, leitura de cupom fiscal) já se beneficia
// sem precisar mudar cada chamada.
//
// Protegido porque `expo-blob` resolve o módulo nativo já no import: onde ele
// não existe — Expo Go, por exemplo — isso derruba o app no boot, antes de
// qualquer tela. Sem a troca o Blob do React Native segue valendo: mais lento,
// e nada além disso muda.
try {
  const ExpoBlob = (require("expo-blob") as typeof import("expo-blob")).Blob;
  // @ts-expect-error -- expo-blob substitui o Blob nativo do RN globalmente.
  globalThis.Blob = ExpoBlob;
} catch {
  // Segue com o Blob do React Native.
}
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSession } from "@/lib/auth-client";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { registerPushToken, subscribeToNotificationTaps } from "@/lib/push";
import { routeFromPushData } from "@/lib/notification-links";

function RootNavigator() {
  const { data: session, isPending, error, refetch } = useSession();
  // Sem resposta do servidor não dá para saber se há sessão: mandar para o
  // login nesse caso pareceria que a conta saiu.
  const offline = !isPending && !session && !!error;
  const segments = useSegments();
  const router = useRouter();
  const { scheme, colors } = useTheme();

  useEffect(() => {
    if (isPending || offline) return;
    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, isPending, offline, segments, router]);

  // Registra o aparelho pra push e trata o toque no aviso. Depende da sessão:
  // o token é gravado por usuário, então registrar antes do login o atribuiria
  // à conta errada.
  useEffect(() => {
    if (!session) return;
    void registerPushToken();

    // Tocar no aviso abre a tela do assunto, não só o app.
    return subscribeToNotificationTaps((data) => {
      const route = routeFromPushData(data);
      if (route) router.push(route as never);
    });
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

  if (offline) {
    return (
      <View
        className="flex-1 items-center justify-center gap-3 bg-background p-8 dark:bg-background-dark"
        style={{ backgroundColor: colors.background }}
      >
        <Ionicons name="cloud-offline-outline" size={40} color={colors.mutedForeground} />
        <Text className="text-center text-lg font-semibold text-foreground dark:text-foreground-dark">
          Sem conexão com o servidor
        </Text>
        <Text className="text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
          Confira a internet e tente de novo. Seus dados continuam guardados.
        </Text>
        <Pressable
          onPress={() => void refetch()}
          className="mt-3 items-center rounded-md bg-primary px-6 py-3 dark:bg-primary-dark"
        >
          <Text className="font-semibold text-primary-foreground dark:text-primary-foreground-dark">Tentar de novo</Text>
        </Pressable>
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
        <Stack.Screen name="scan-receipt" options={{ ...modalHeaderOptions, title: "Ler QR do cupom" }} />
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
        <Stack.Screen name="receipt-rewards" options={{ ...stackHeaderOptions, title: "Recompensa por cupom" }} />
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
        <Stack.Screen name="changelog" options={{ ...stackHeaderOptions, title: "Novidades" }} />
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
