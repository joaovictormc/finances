import { Platform } from "react-native";
import Constants from "expo-constants";
import { isRunningInExpoGo } from "expo";
import { api } from "./api-client";

/**
 * `expo-notifications` e `expo-device` resolvem o módulo nativo já no `import`
 * (`requireNativeModule` em escopo de módulo, fora de qualquer try). No Expo Go
 * esses módulos não existem e o app morre no boot, antes de renderizar qualquer
 * tela — por isso o carregamento aqui é sob demanda e sempre protegido.
 *
 * No Expo Go nem tentamos: a Expo removeu push do Expo Go no SDK 53, então push
 * exige development build de qualquer forma. Desligar aqui não tira nada que
 * funcionasse — e mantém a central de notificações dentro do app inteira.
 */
type NotificationsModule = typeof import("expo-notifications");
type DeviceModule = typeof import("expo-device");

let notificationsPromise: Promise<NotificationsModule | null> | undefined;
let devicePromise: Promise<DeviceModule | null> | undefined;
let handlerInstalled = false;

function loadNotifications(): Promise<NotificationsModule | null> {
  notificationsPromise ??= isRunningInExpoGo()
    ? Promise.resolve(null)
    : import("expo-notifications").catch(() => null);
  return notificationsPromise;
}

function loadDevice(): Promise<DeviceModule | null> {
  devicePromise ??= isRunningInExpoGo()
    ? Promise.resolve(null)
    : import("expo-device").catch(() => null);
  return devicePromise;
}

/**
 * Canal do Android. Sem um canal declarado o sistema entrega sem som nem
 * prioridade — e o nome é o que o usuário vê nas configurações do aparelho.
 * O id "default" tem que bater com o `channelId` que a API manda.
 */
async function ensureAndroidChannel(Notifications: NotificationsModule) {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Avisos do ControlAI",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Carrega o módulo e instala, uma única vez, o handler de primeiro plano. Sem
 * ele o push chega mas não é exibido com o app aberto, e parece que falhou.
 */
async function prepareNotifications(): Promise<NotificationsModule | null> {
  const Notifications = await loadNotifications();
  if (!Notifications) return null;

  if (!handlerInstalled) {
    handlerInstalled = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }

  return Notifications;
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
  try {
    const Notifications = await prepareNotifications();
    if (!Notifications) return null;

    // Emulador não recebe push; pedir permissão lá só polui o log.
    const Device = await loadDevice();
    if (!Device?.isDevice) return null;

    await ensureAndroidChannel(Notifications);

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

/**
 * Assina o toque no aviso para abrir a tela do assunto, não só o app.
 *
 * Devolve a função de cancelamento na hora — o módulo é carregado de forma
 * assíncrona, então a assinatura pode chegar depois do unmount e precisa ser
 * descartada quando isso acontecer.
 */
export function subscribeToNotificationTaps(onTap: (data: unknown) => void): () => void {
  let subscription: { remove: () => void } | null = null;
  let cancelled = false;

  void prepareNotifications().then((Notifications) => {
    if (!Notifications || cancelled) return;
    subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      onTap(response.notification.request.content.data);
    });
  });

  return () => {
    cancelled = true;
    subscription?.remove();
    subscription = null;
  };
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
