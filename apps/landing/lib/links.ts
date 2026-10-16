// Endereço do app web (login e cadastro). Definido no deploy; enquanto não
// houver domínio, cai no app rodando localmente.
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const SIGNUP_URL = `${APP_URL}/register`;
export const LOGIN_URL = `${APP_URL}/login`;

// API pública, vista pelo navegador (atualização dos preços).
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

// A mesma API vista pelo servidor da landing — no Docker, o nome do serviço.
export const SERVER_API_URL = (process.env.API_INTERNAL_URL ?? API_URL).replace(/\/$/, "");

/**
 * Destino de um botão vindo do conteúdo editável: "signup" e "login" viram
 * o app; uma âncora fora da página inicial aponta para a inicial.
 */
export function resolveHref(href: string, isHome: boolean): string {
  if (href === "signup") return SIGNUP_URL;
  if (href === "login") return LOGIN_URL;
  if (href.startsWith("#") && !isHome) return `/${href}`;
  return href;
}
