import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { api } from "./api-client";

// Como o aviso aparece com o app aberto. Sem isso o push chega mas não é
// exibido em primeiro plano, e parece que não funcionou.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Canal do Android. Sem um canal declarado o sistema entrega sem som nem
 * prioridade — e o nome é o que o usuário vê nas configurações do aparelho.
 * O id "default" tem que bater com o `channelId` que a API manda.
 */
async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Avisos do ControlAI",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Guardado pra que o logout consiga desregistrar sem pedir o token de novo. */
let lastRegisteredToken: string | null = null;

/**
 * Pede permissão, obtém o token do Expo e registra na API.
 *
 * Silencioso em falha: ficar sem push é degradação aceitável — a central dentro
 * do app continua inteira, e um erro aqui não pode atrapalhar a entrada no app.
 */
export async function registerPushToken(): Promise<string | null> {
  // Emulador não recebe push; pedir permissão lá só polui o log.
  if (!Device.isDevice) return null;

  try {
    await ensureAndroidChannel();

    const current = await Notifications.getPermissionsAsync();
    const status =
      current.status === "granted"
        ? current.status
        : (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return null;

    // projectId vem do app.json (extra.eas.projectId); sem ele a Expo não emite
    // token em build standalone.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    lastRegisteredToken = token;

    await api.post("/api/notifications/push-token", {
      token,
      platform: Platform.OS === "ios" ? "ios" : "android",
      deviceName: Device.deviceName ?? undefined,
    });

    return token;
  } catch {
    return null;
  }
}

/** No logout o aparelho não deve mais receber aviso desta conta. */
export async function unregisterCurrentPushToken(): Promise<void> {
  const token = lastRegisteredToken;
  if (!token) return;
  lastRegisteredToken = null;

  try {
    await api.post("/api/notifications/push-token/remove", { token });
  } catch {
    // Sair da conta não pode falhar por causa disso. Se o token ficar órfão, o
    // servidor o apaga quando a Expo devolver DeviceNotRegistered.
  }
}
