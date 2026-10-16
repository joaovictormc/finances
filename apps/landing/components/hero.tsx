import type { LandingBlockData } from "@finances/validations";
import { AssistantDemo } from "./assistant-demo";
import { PhoneIcon } from "./icons";
import { kern } from "./kern";
import { SIGNUP_URL, resolveHref } from "@/lib/links";
import type { BlockContext } from "./block-context";

export function Hero({ data, anchor, ctx }: { data: LandingBlockData<"hero">; anchor?: string; ctx: BlockContext }) {
  const Heading = ctx.headingLevel === 1 ? "h1" : "h2";
  return (
    <section id={anchor || undefined} className="mx-auto max-w-[1240px] px-5 pb-24 pt-12 sm:px-8 md:pb-32 md:pt-12">
      <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-10">
        <div>
          <Heading className="font-display text-[clamp(46px,6.6vw,84px)] font-extrabold leading-[0.98] tracking-[-0.035em] text-balance">
            {kern(data.title)}
          </Heading>
          {data.subtitle && (
            <p className="mt-7 max-w-[540px] text-[clamp(17px,1.5vw,20px)] leading-[1.6] text-ink-2">{data.subtitle}</p>
          )}
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            <a
              href={SIGNUP_URL}
              className="flex min-h-14 items-center rounded-xl bg-ink px-7 text-[17px] font-semibold text-paper transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_14px_30px_-16px_rgba(28,28,30,0.7)]"
            >
              {data.primaryLabel}
            </a>
            {data.secondaryLabel && data.secondaryHref && (
              <a
                href={resolveHref(data.secondaryHref, ctx.isHome)}
                className="text-[16px] font-medium text-ink underline decoration-ink-3/60 underline-offset-[6px] hover:decoration-ink"
              >
                {data.secondaryLabel}
              </a>
            )}
          </div>
          {data.note && (
            <p className="mt-8 flex items-center gap-2 text-[14.5px] text-ink-3">
              <PhoneIcon size={17} />
              {data.note}
            </p>
          )}
        </div>

        <AssistantDemo
          exchanges={data.exchanges}
          summaryLabel={data.summaryLabel}
          summaryValue={data.summaryValue}
          demoLabel={data.demoLabel}
        />
      </div>
    </section>
  );
}
