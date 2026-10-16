import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LANDING_HOME_SLUG } from "@finances/validations";
import { PageShell } from "@/components/page-shell";
import { getPage, getPublishedIndex } from "@/lib/content";

export const revalidate = 3600;
// Páginas criadas depois do deploy também abrem (geradas no primeiro acesso).
export const dynamicParams = true;

export async function generateStaticParams() {
  const { slugs } = await getPublishedIndex();
  return slugs.filter((slug) => slug !== LANDING_HOME_SLUG).map((slug) => ({ slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const page = slug === LANDING_HOME_SLUG ? null : await getPage(slug);
  return page ? { title: `${page.title} · ControlAI`, description: page.description || undefined } : {};
}

export default async function LandingSubPage({ params }: Params) {
  const { slug } = await params;
  // /inicio é a raiz; não existe como página separada.
  if (slug === LANDING_HOME_SLUG) notFound();
  const [page, index] = await Promise.all([getPage(slug), getPublishedIndex()]);
  if (!page) notFound();
  return <PageShell sections={page.sections} isHome={false} site={index} />;
}
