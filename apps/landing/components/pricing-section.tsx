import type { LandingBlockData } from "@finances/validations";
import { kern } from "./kern";
import { Pricing } from "./pricing";
import type { BlockContext } from "./block-context";

export function PricingSection({ data, anchor, ctx }: { data: LandingBlockData<"pricing">; anchor?: string; ctx: BlockContext }) {
  const Heading = ctx.headingLevel === 1 ? "h1" : "h2";
  return (
    <section id={anchor || undefined} className="border-t border-rule bg-paper-2">
      <div className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 md:py-32">
        <Heading className="max-w-[760px] font-display text-[clamp(34px,4.4vw,52px)] font-extrabold leading-[1.05] tracking-[-0.025em] text-balance">
          {kern(data.title)}
        </Heading>
        <Pricing initialPlans={ctx.plans} footnote={data.footnote} />
      </div>
    </section>
  );
}
