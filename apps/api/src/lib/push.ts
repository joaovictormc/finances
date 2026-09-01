import { db } from "@finances/db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const SEND_TIMEOUT_MS = 10_000;

/** Recibo que a Expo devolve por mensagem enviada. */
type ExpoTicket = { status?: string; message?: string; details?: { error?: string } };

export type PushPayload = {
  title: string;
  body: string;
  /** Vai junto no push e volta pro app quando o usuário toca — usado pro destino. */
  data?: Record<string, unknown>;
};

/**
 * Envia push para os aparelhos do usuário pelo Expo Push Service.
 *
 * Não fala com FCM/APNs direto: quem fala com Google e Apple é a Expo, e o que
 * guardamos é o `ExponentPushToken[...]` que o app registra. Assim a API não
 * precisa de credencial de push nenhuma — as do build ficam no EAS.
 *
 * Falha aberta de propósito: push é entrega acessória. O aviso in-app já foi
 * gravado antes de chegar aqui, e derrubar quem gerou a notificação por causa
 * de um push fora do ar trocaria um problema pequeno por um grande.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const tokens = await db.pushToken.findMany({ where: { userId }, select: { token: true } });
  if (tokens.length === 0) return;

  const targets = tokens.map((row) => row.token);
  const messages = targets.map((token) => ({
    to: token,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    sound: "default",
    // O canal precisa existir no app (criado no registro do token), senão o
    // Android entrega sem som nem prioridade.
    channelId: "default",
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(`[push] Expo respondeu ${response.status}`);
      return;
    }

    const result = (await response.json()) as { data?: ExpoTicket[] };
    await dropUnregisteredTokens(result.data ?? [], targets);
  } catch (error) {
    console.warn("[push] Falha ao enviar:", (error as Error).message);
  }
}

/**
 * `DeviceNotRegistered` significa app desinstalado ou token revogado. A Expo
 * pede explicitamente que o token pare de ser usado — insistir faz o remetente
 * ser limitado, então a linha morta é apagada na hora.
 */
async function dropUnregisteredTokens(tickets: ExpoTicket[], targets: string[]) {
  const dead = tickets
    .map((ticket, index) => (ticket.details?.error === "DeviceNotRegistered" ? targets[index] : null))
    .filter((token): token is string => !!token);

  if (dead.length === 0) return;
  await db.pushToken.deleteMany({ where: { token: { in: dead } } });
}
