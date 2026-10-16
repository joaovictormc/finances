import type { Metadata } from "next";
import { LANDING_HOME_SLUG } from "@finances/validations";
import { PageShell } from "@/components/page-shell";
import { getPage, getPublishedIndex } from "@/lib/content";

// Regerada ao publicar no admin (/api/revalidate); de hora em hora por garantia.
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage(LANDING_HOME_SLUG);
  return page ? { title: page.title, description: page.description || undefined } : {};
}

export default async function HomePage() {
  const [page, index] = await Promise.all([getPage(LANDING_HOME_SLUG), getPublishedIndex()]);
  // getPage nunca devolve null para a inicial (cai no conteúdo de fábrica).
  return <PageShell sections={page!.sections} isHome site={index} />;
}
