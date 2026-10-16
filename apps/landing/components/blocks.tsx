import type { LandingSection } from "@finances/validations";
import type { Plan } from "@/lib/plans";
import type { BlockContext } from "./block-context";
import { Hero } from "./hero";
import { FamilyLedger } from "./family-ledger";
import { RolesSection } from "./roles-section";
import { ProductRows } from "./product-rows";
import { PricingSection } from "./pricing-section";
import { Faq } from "./faq";
import { ClosingCta } from "./closing";
import { TextBlock } from "./text-block";
import { Highlights } from "./highlights";

/** Monta a página a partir dos blocos publicados, na ordem do editor. */
export function Blocks({ sections, isHome, plans }: { sections: LandingSection[]; isHome: boolean; plans: Plan[] | null }) {
  const visible = sections.filter((s) => !s.hidden);
  return (
    <>
      {visible.map((section, index) => {
        const ctx: BlockContext = { isHome, plans, headingLevel: index === 0 ? 1 : 2 };
        const props = { anchor: section.anchor, ctx };
        switch (section.type) {
          case "hero":
            return <Hero key={section.id} data={section.data} {...props} />;
          case "ledger":
            return <FamilyLedger key={section.id} data={section.data} {...props} />;
          case "roles":
            return <RolesSection key={section.id} data={section.data} {...props} />;
          case "productRows":
            return <ProductRows key={section.id} data={section.data} {...props} />;
          case "pricing":
            return <PricingSection key={section.id} data={section.data} {...props} />;
          case "faq":
            return <Faq key={section.id} data={section.data} {...props} />;
          case "cta":
            return <ClosingCta key={section.id} data={section.data} {...props} />;
          case "text":
            return <TextBlock key={section.id} data={section.data} {...props} />;
          case "highlights":
            return <Highlights key={section.id} data={section.data} {...props} />;
        }
      })}
    </>
  );
}

/** Algum bloco precisa dos preços? Só então a página busca os planos. */
export function needsPlans(sections: LandingSection[]): boolean {
  return sections.some((s) => !s.hidden && s.type === "pricing");
}
