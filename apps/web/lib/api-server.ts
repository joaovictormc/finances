import { cookies } from "next/headers";

// Roda no servidor Node (Server Component), não no browser — fala direto com
// o container da API via rede Docker (mesma var usada em next.config.ts).
const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
const API_TIMEOUT_MS = 15_000;

async function parseApiError(res: Response): Promise<Error> {
  const payload = await res.json().catch(() => ({ error: "Falha na API" }));
  const requestId = res.headers.get("x-request-id");
  const message = (payload as { error?: string }).error ?? "Falha na API";
  return new Error(requestId ? `${message} (requisição ${requestId})` : message);
}

export async function serverApiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  let url = `${API_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) searchParams.set(k, String(v));
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const cookieStore = await cookies();
  const res = await fetch(url, {
    headers: { Cookie: cookieStore.toString() },
    cache: "no-store",
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw await parseApiError(res);
  }

  return res.json() as Promise<T>;
}

export async function serverApiPost<T>(path: string, body?: unknown): Promise<T> {
  const cookieStore = await cookies();
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { Cookie: cookieStore.toString(), "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw await parseApiError(res);
  }

  return res.json() as Promise<T>;
}
