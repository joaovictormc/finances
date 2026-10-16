import type { LandingSection, LandingSiteIndex } from "@finances/validations";
import { fetchPlans } from "@/lib/plans";
import { Blocks, needsPlans } from "./blocks";
import { SiteFooter } from "./closing";
import { SiteHeader } from "./site-header";

/** Moldura comum: cabeçalho, blocos da página e rodapé. */
export async function PageShell({
  sections,
  isHome,
  site,
  banner,
}: {
  sections: LandingSection[];
  isHome: boolean;
  site: LandingSiteIndex;
  banner?: React.ReactNode;
}) {
  const plans = needsPlans(sections) ? await fetchPlans() : null;
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Pular para o conteúdo
      </a>
      {banner}
      <SiteHeader isHome={isHome} menu={site.menu} />
      <main id="conteudo">
        <Blocks sections={sections} isHome={isHome} plans={plans} />
      </main>
      <SiteFooter isHome={isHome} menu={site.menu} pages={site.footer} />
    </>
  );
}
