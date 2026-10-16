import "server-only";
import {
  DEFAULT_HOME_PAGE,
  DEFAULT_HOME_SECTIONS,
  DEFAULT_LANDING_MENU,
  LANDING_HOME_SLUG,
  type LandingSiteIndex,
  type PublishedLandingPage,
} from "@finances/validations";
import { SERVER_API_URL } from "./links";

// Revalidação de segurança: mesmo se o aviso de publicação falhar, a página
// se atualiza sozinha dentro de uma hora.
const REVALIDATE_SECONDS = 3600;

async function getJson<T>(path: string, init?: RequestInit & { next?: { revalidate?: number | false } }): Promise<T | null> {
  try {
    const res = await fetch(`${SERVER_API_URL}${path}`, { signal: AbortSignal.timeout(5000), ...init });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Página publicada. A inicial nunca fica em branco: sem API (build sem rede,
 * API fora do ar), usa o conteúdo de fábrica.
 */
export async function getPage(slug: string): Promise<PublishedLandingPage | null> {
  const page = await getJson<PublishedLandingPage>(`/api/public/landing/pages/${encodeURIComponent(slug)}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (page) return page;
  if (slug === LANDING_HOME_SLUG) {
    return { slug, ...DEFAULT_HOME_PAGE, sections: DEFAULT_HOME_SECTIONS, publishedAt: null };
  }
  return null;
}

/** Páginas publicadas, links de rodapé e menu. Sem API, o menu de fábrica. */
export async function getPublishedIndex(): Promise<LandingSiteIndex> {
  const index = await getJson<Partial<LandingSiteIndex>>("/api/public/landing/pages", {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  // Campo a campo: uma resposta de versão anterior da API (ou do cache) sem
  // "menu" não pode derrubar o cabeçalho de todas as páginas.
  return {
    slugs: Array.isArray(index?.slugs) ? index.slugs : [],
    footer: Array.isArray(index?.footer) ? index.footer : [],
    menu: Array.isArray(index?.menu) ? index.menu : DEFAULT_LANDING_MENU,
  };
}

/** Rascunho, para a pré-visualização do admin. Nunca em cache. */
export async function getPreview(token: string): Promise<PublishedLandingPage | null> {
  return getJson<PublishedLandingPage>(`/api/public/landing/preview/${encodeURIComponent(token)}`, { cache: "no-store" });
}
