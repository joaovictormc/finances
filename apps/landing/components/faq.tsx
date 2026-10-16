import type { LandingBlockData } from "@finances/validations";
import { kern } from "@/components/kern";
import { ChevronIcon } from "./icons";
import type { BlockContext } from "./block-context";

export function Faq({ data, anchor, ctx }: { data: LandingBlockData<"faq">; anchor?: string; ctx: BlockContext }) {
  const Heading = ctx.headingLevel === 1 ? "h1" : "h2";
  return (
    <section id={anchor || undefined} className="border-t border-rule">
      <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-24 sm:px-8 md:py-32 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
        <Heading className="font-display text-[clamp(34px,4.4vw,52px)] font-extrabold leading-[1.05] tracking-[-0.025em] text-balance">
          {kern(data.title)}
        </Heading>
        <div className="border-t border-ink">
          {data.items.map((item, i) => (
            <details key={`${i}-${item.question}`} className="group border-b border-rule">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17.5px] font-semibold [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronIcon size={20} className="shrink-0 text-ink-3 transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <p className="max-w-[62ch] whitespace-pre-line pb-6 text-[16.5px] leading-[1.7] text-ink-2">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
