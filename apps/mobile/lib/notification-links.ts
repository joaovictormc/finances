/**
 * Para onde uma notificação leva no app.
 *
 * O destino é gravado pela API pensando na web (`/overview`, `/groups/{id}`),
 * e o app tem outra árvore de rotas. A tradução mora aqui porque dois caminhos
 * precisam dela: a lista dentro do app e o toque no push.
 */

const WEB_TO_MOBILE: Record<string, string> = {
  "/overview": "/(tabs)",
  "/transactions": "/(tabs)/transactions",
  "/budgets": "/(tabs)/budgets",
  "/accounts": "/(tabs)/accounts",
  "/bills": "/bills",
  "/goals": "/goals",
  "/groups": "/groups",
  "/rewards": "/rewards",
};

/** Destino por tipo, para avisos gravados antes de os emissores mandarem link. */
const FALLBACK_LINKS: Record<string, string> = {
  insight_ready: "/overview",
  budget_alert: "/budgets",
  overdraft_warning: "/accounts",
  bill_reminder: "/bills",
  goal_milestone: "/goals",
  group_activity: "/groups",
  referral_reward: "/rewards",
};

/** Só caminho interno: URL absoluta viraria redirecionador aberto. */
function asInternalPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

/** Converte o caminho da web na rota do app, ou null se a tela só existe na web. */
export function toMobileRoute(webPath: string): string | null {
  const direct = WEB_TO_MOBILE[webPath];
  if (direct) return direct;

  // A web usa /groups/{id}; no app a tela do grupo é rota própria com o id
  // como parâmetro.
  const group = /^\/groups\/([^/]+)$/.exec(webPath);
  if (group?.[1]) return `/group-detail?id=${group[1]}`;

  // /admin/* e a tela de cobrança da web não têm equivalente aqui — o aviso
  // fica informativo em vez de levar a uma tela que não existe.
  return null;
}

/** Rota do app para uma notificação da lista, considerando o fallback por tipo. */
export function routeForNotification(item: {
  type: string;
  metadata: Record<string, unknown> | null;
}): string | null {
  const webPath = asInternalPath(item.metadata?.link) ?? FALLBACK_LINKS[item.type] ?? null;
  return webPath ? toMobileRoute(webPath) : null;
}

/** Rota do app para o `data` que veio dentro do push. */
export function routeFromPushData(data: unknown): string | null {
  const webPath = asInternalPath((data as { link?: unknown } | null)?.link);
  return webPath ? toMobileRoute(webPath) : null;
}
