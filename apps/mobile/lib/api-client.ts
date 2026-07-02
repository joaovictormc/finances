import { Platform } from "react-native";
import { authClient } from "./auth-client";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";
const isWeb = Platform.OS === "web";

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

  // No nativo não existe cookie jar de navegador: o plugin Expo do Better Auth
  // guarda a sessão como cookie no expo-secure-store e mandamos esse cookie de
  // volta manualmente (mesmo mecanismo recomendado pela doc do Better Auth/Expo).
  // Também mandamos o header `Origin` (derivado do API_URL) pra passar na
  // verificação de origin do Better Auth, que valida contra trustedOrigins.
  // Na web o navegador já tem cookie jar e cuida do `Origin` sozinho — e não
  // deixa JS setar o header `Cookie` manualmente —, então usamos
  // `credentials: include` pra ele mandar/receber o cookie de sessão sozinho.
  const origin = new URL(API_URL).origin;
  const fetchInit: RequestInit = {
    method,
    headers: isWeb
      ? { "Content-Type": "application/json" }
      : {
          "Content-Type": "application/json",
          Cookie: authClient.getCookie(),
          Origin: origin,
        },
    credentials: isWeb ? "include" : undefined,
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

async function upload<T>(path: string, formData: FormData): Promise<T> {
  // Sem Content-Type manual: o fetch define `multipart/form-data; boundary=...`
  // sozinho a partir do FormData (setar na mão quebra o boundary).
  const fetchInit: RequestInit = {
    method: "POST",
    body: formData,
    headers: isWeb ? undefined : { Cookie: authClient.getCookie(), Origin: new URL(API_URL).origin },
    credentials: isWeb ? "include" : undefined,
  };

  const res = await fetch(`${API_URL}${path}`, fetchInit);

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
  upload,
};
