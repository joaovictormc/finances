import type { LandingMenuItem } from "@finances/validations";
import { LogoMark } from "./icons";
import { LOGIN_URL, resolveHref } from "@/lib/links";
import { HeaderCta } from "./header-cta";


export function SiteHeader({ isHome, menu }: { isHome: boolean; menu: LandingMenuItem[] }) {
  return (
    // Fundo sólido, sem backdrop-blur: o desfoque reprocessa a tela a cada
    // quadro de rolagem e pesa justamente nas máquinas fracas.
    <header className="sticky top-0 z-30 border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-[1240px] items-center gap-8 px-5 py-3 sm:px-8">
        <a href={isHome ? "#topo" : "/"} className="flex items-center gap-2.5 rounded-md" aria-label="ControlAI, início">
          <LogoMark size={30} />
          <span className="font-display text-[19px] font-extrabold tracking-[-0.01em]">ControlAI</span>
        </a>

        <nav aria-label="Seções" className="hidden items-center gap-7 text-[15px] text-ink-2 md:flex">
          {menu.map((item) => (
            <a key={`${item.label}-${item.href}`} href={resolveHref(item.href, isHome)} className="rounded-sm transition-colors hover:text-ink">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <a
            href={LOGIN_URL}
            className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-ink-2 transition-colors hover:text-ink"
          >
            Entrar
          </a>
          <HeaderCta />
        </div>
      </div>
    </header>
  );
}
