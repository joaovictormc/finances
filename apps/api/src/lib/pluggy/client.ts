const PLUGGY_API_URL = "https://api.pluggy.ai";

let cachedApiKey: { key: string; expiresAt: number } | null = null;

async function getApiKey(): Promise<string> {
  if (cachedApiKey && cachedApiKey.expiresAt > Date.now()) {
    return cachedApiKey.key;
  }

  const res = await fetch(`${PLUGGY_API_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: process.env.PLUGGY_CLIENT_ID,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    throw new Error(`Pluggy auth falhou: ${res.status} ${await res.text()}`);
  }

  const { apiKey } = (await res.json()) as { apiKey: string };
  // token dura 2h na Pluggy; renovamos com 5min de margem
  cachedApiKey = { key: apiKey, expiresAt: Date.now() + 115 * 60 * 1000 };
  return apiKey;
}

async function pluggyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = await getApiKey();
  const res = await fetch(`${PLUGGY_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Pluggy ${path} falhou: ${res.status} ${await res.text()}`);
  }

  return res.json() as Promise<T>;
}

export async function createConnectToken(clientUserId: string, itemId?: string): Promise<string> {
  // a API da Pluggy devolve o token no campo "accessToken" (não "connectToken", apesar do nome do endpoint)
  const { accessToken } = await pluggyFetch<{ accessToken: string }>("/connect_token", {
    method: "POST",
    body: JSON.stringify({
      itemId,
      options: { clientUserId, avoidDuplicates: true },
    }),
  });
  return accessToken;
}

export type PluggyAccount = {
  id: string;
  itemId: string;
  type: "BANK" | "CREDIT";
  subtype: string;
  number: string;
  name: string;
  marketingName: string | null;
  balance: number;
  currencyCode: string;
};

export async function fetchAccounts(itemId: string): Promise<PluggyAccount[]> {
  const { results } = await pluggyFetch<{ results: PluggyAccount[] }>(
    `/accounts?itemId=${encodeURIComponent(itemId)}`
  );
  return results;
}

export type PluggyTransaction = {
  id: string;
  accountId: string;
  description: string;
  descriptionRaw: string | null;
  amount: number;
  date: string;
  type: "DEBIT" | "CREDIT";
  category: string | null;
  merchant: { businessName: string | null } | null;
};

export async function fetchTransactions(
  accountId: string,
  cursor?: string
): Promise<{ results: PluggyTransaction[]; next: string | null }> {
  const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
  return pluggyFetch<{ results: PluggyTransaction[]; next: string | null }>(
    `/v2/transactions?accountId=${encodeURIComponent(accountId)}${cursorParam}`
  );
}

export async function fetchItem(itemId: string): Promise<{ id: string; status: string }> {
  return pluggyFetch(`/items/${encodeURIComponent(itemId)}`);
}
