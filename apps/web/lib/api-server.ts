import { cookies } from "next/headers";

// Roda no servidor Node (Server Component), não no browser — fala direto com
// o container da API via rede Docker (mesma var usada em next.config.ts).
const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

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
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error((error as { error: string }).error ?? "Request failed");
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
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error((error as { error: string }).error ?? "Request failed");
  }

  return res.json() as Promise<T>;
}
