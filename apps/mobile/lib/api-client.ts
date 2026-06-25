import { authClient } from "./auth-client";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, params } = opts;

  let url = `${API_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) searchParams.set(k, String(v));
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  // O plugin Expo do Better Auth guarda a sessão como cookie no expo-secure-store;
  // mandamos esse cookie de volta manualmente, já que não existe cookie jar de
  // navegador no app nativo (mesmo mecanismo recomendado pela doc do Better Auth/Expo).
  const fetchInit: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: authClient.getCookie(),
    },
    cache: "no-store" as RequestCache,
  };
  if (body !== undefined) fetchInit.body = JSON.stringify(body);

  const res = await fetch(url, fetchInit);

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error((error as { error: string }).error ?? "Request failed");
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, params?: RequestOptions["params"]) =>
    request<T>(path, { method: "GET", params }),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
