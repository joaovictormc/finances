import Link from "next/link";
import type { LandingBlockData, LandingFooterLink, LandingMenuItem } from "@finances/validations";
import { kern } from "@/components/kern";
import { LogoMark } from "./icons";
import { resolveHref } from "@/lib/links";
import type { BlockContext } from "./block-context";

export function ClosingCta({ data, anchor, ctx }: { data: LandingBlockData<"cta">; anchor?: string; ctx: BlockContext }) {
  const Heading = ctx.headingLevel === 1 ? "h1" : "h2";
  return (
    <section id={anchor || undefined} className="on-night bg-night text-night-ink">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-10 px-5 py-24 sm:px-8 md:flex-row md:items-end md:justify-between md:py-28">
        <Heading className="max-w-[720px] font-display text-[clamp(38px,5.2vw,64px)] font-extrabold leading-[1.02] tracking-[-0.03em] text-balance">
          {kern(data.title)}
        </Heading>
        <div className="flex flex-wrap items-center gap-5">
          <a
            href={resolveHref(data.primaryHref, ctx.isHome)}
            className="flex min-h-14 items-center rounded-xl bg-marker px-7 text-[17px] font-semibold text-ink transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_14px_30px_-14px_rgba(255,195,0,0.75)]"
          >
            {data.primaryLabel}
          </a>
          {data.secondaryLabel && data.secondaryHref && (
            <a
              href={resolveHref(data.secondaryHref, ctx.isHome)}
              className="text-[16px] font-medium text-night-ink-2 underline-offset-4 hover:text-night-ink hover:underline"
            >
              {data.secondaryLabel}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}


export function SiteFooter({ isHome, menu, pages }: { isHome: boolean; menu: LandingMenuItem[]; pages: LandingFooterLink[] }) {
  return (
    <footer className="on-night border-t border-night-rule bg-night text-night-ink-2">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-8 gap-y-4 px-5 py-8 text-[14px] sm:px-8">
        <Link href="/" className="flex items-center gap-2 text-night-ink">
          <LogoMark size={22} />
          <span className="font-display font-bold">ControlAI</span>
        </Link>
        <span>Finanças da família, em português.</span>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2 md:ml-auto">
          {menu.map((item) => (
            <a key={`${item.label}-${item.href}`} href={resolveHref(item.href, isHome)} className="hover:text-night-ink">
              {item.label}
            </a>
          ))}
          {/* Páginas criadas no admin com "mostrar no rodapé" (Termos, Privacidade…). */}
          {pages.map((page) => (
            <Link key={page.slug} href={`/${page.slug}`} className="hover:text-night-ink">
              {page.title}
            </Link>
          ))}
        </nav>
        <span className="w-full text-[13px] text-[#8a8a91] md:w-auto">© 2026 ControlAI</span>
      </div>
    </footer>
  );
}
