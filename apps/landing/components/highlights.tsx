import type { LandingBlockData } from "@finances/validations";
import { kern } from "./kern";
import { CalendarCheckIcon, CameraIcon, ChartIcon, CheckIcon, FileIcon, PhoneIcon, ShieldIcon, UsersIcon } from "./icons";
import type { BlockContext } from "./block-context";

const ICONS = {
  camera: CameraIcon,
  file: FileIcon,
  calendar: CalendarCheckIcon,
  phone: PhoneIcon,
  check: CheckIcon,
  users: UsersIcon,
  chart: ChartIcon,
  shield: ShieldIcon,
} as const;

/**
 * Destaques como linhas de extrato (régua entre itens, ícone na margem),
 * não como grade de cards iguais.
 */
export function Highlights({ data, anchor, ctx }: { data: LandingBlockData<"highlights">; anchor?: string; ctx: BlockContext }) {
  const Heading = ctx.headingLevel === 1 ? "h1" : "h2";
  return (
    <section id={anchor || undefined} className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 md:py-32">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div>
          <Heading className="font-display text-[clamp(34px,4.4vw,52px)] font-extrabold leading-[1.05] tracking-[-0.025em] text-balance">
            {kern(data.title)}
          </Heading>
          {data.body && <p className="mt-5 max-w-[460px] text-[18px] leading-[1.65] text-ink-2">{data.body}</p>}
        </div>
        <ul className="flex flex-col border-t border-ink">
          {data.items.map((item, i) => {
            const Icon = ICONS[item.icon];
            return (
              <li key={`${i}-${item.title}`} className="flex gap-5 border-b border-rule py-6">
                <Icon size={22} className="mt-0.5 shrink-0 text-ink" />
                <div>
                  <h3 className="font-display text-[19px] font-bold leading-snug">{item.title}</h3>
                  {item.text && <p className="mt-1.5 text-[16px] leading-[1.6] text-ink-2">{item.text}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
