import type { Metadata } from "next";
import { LANDING_HOME_SLUG } from "@finances/validations";
import { PageShell } from "@/components/page-shell";
import { getPreview, getPublishedIndex } from "@/lib/content";

// Rascunho: sempre buscado na hora, nunca indexado.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pré-visualização · ControlAI", robots: { index: false, follow: false } };

export default async function PreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [page, index] = await Promise.all([getPreview(token), getPublishedIndex()]);

  if (!page) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[560px] flex-col justify-center px-6">
        <h1 className="font-display text-[32px] font-extrabold tracking-[-0.02em]">Link de pré-visualização expirado</h1>
        <p className="mt-4 text-[17px] leading-[1.6] text-ink-2">
          Os links valem 30 minutos. Volte ao editor da landing no painel admin e clique em Pré-visualizar de novo.
        </p>
      </main>
    );
  }

  return (
    <PageShell
      sections={page.sections}
      isHome={page.slug === LANDING_HOME_SLUG}
      site={index}
      banner={
        <p role="status" className="bg-ink px-5 py-2.5 text-center text-[14px] font-medium text-paper">
          Pré-visualização do rascunho de “{page.title}”. Visitantes ainda veem a versão publicada.
        </p>
      }
    />
  );
}
