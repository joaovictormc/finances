import type { LandingBlockData } from "@finances/validations";
import { kern } from "@/components/kern";
import { ArrowRightIcon, CalendarCheckIcon, FileIcon } from "./icons";
import type { BlockContext } from "./block-context";

function Receipt() {
  // Cupom fiscal desenhado: o objeto de verdade que a pessoa fotografa.
  return (
    <div className="w-[208px] shrink-0 -rotate-[2.5deg] rounded-[4px] bg-white px-5 pb-6 pt-5 shadow-[0_18px_36px_-22px_rgba(28,28,30,0.55),0_1px_2px_rgba(28,28,30,0.12)]">
      <p className="money text-center text-[11px] leading-tight text-ink-2">
        SUPERMERCADO BOM PREÇO
        <br />
        CNPJ 00.000.000/0001-00
      </p>
      <div className="money mt-4 flex flex-col gap-1.5 border-y border-dashed border-ink-3/50 py-3 text-[11.5px] text-ink-2">
        <span className="flex justify-between"><span>ARROZ 5KG</span><span>27,90</span></span>
        <span className="flex justify-between"><span>FEIJÃO 1KG</span><span>8,49</span></span>
        <span className="flex justify-between"><span>CAFÉ 500G</span><span>18,90</span></span>
        <span className="flex justify-between"><span>LEITE 12UN</span><span>59,88</span></span>
        <span className="flex justify-between"><span>FRUTAS</span><span>71,73</span></span>
      </div>
      <p className="money mt-3 flex justify-between text-[13px] font-medium text-ink">
        <span>TOTAL</span>
        <span>186,90</span>
      </p>
      <p className="money mt-1 text-[11px] text-ink-3">14/10/2026 18:42</p>
    </div>
  );
}

function ParsedFields() {
  const fields = [
    { label: "Valor", value: <span className="money">R$ 186,90</span> },
    { label: "Data", value: <span className="money">14/10/2026</span> },
    { label: "Onde", value: "Supermercado Bom Preço" },
    { label: "Categoria", value: <span className="marker font-medium">Supermercado</span> },
  ];
  return (
    <dl className="w-full max-w-[260px] rounded-2xl border border-rule bg-white p-5">
      {fields.map((f, i) => (
        <div key={f.label} className={`flex items-baseline justify-between gap-4 py-2.5 ${i > 0 ? "border-t border-rule" : ""}`}>
          <dt className="text-[13px] text-ink-3">{f.label}</dt>
          <dd className="text-right text-[14.5px]">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatementFiles() {
  const items = [
    { icon: <FileIcon size={18} />, name: "extrato-outubro.ofx", detail: "48 transações, 3 já existiam" },
    { icon: <FileIcon size={18} />, name: "fatura-cartao.csv", detail: "31 transações importadas" },
  ];
  return (
    <ul className="flex w-full max-w-[420px] flex-col divide-y divide-rule rounded-2xl border border-rule bg-white">
      {items.map((item) => (
        <li key={item.name} className="flex items-center gap-4 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper-2 text-ink">{item.icon}</span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-medium">{item.name}</span>
            <span className="block text-[13.5px] text-ink-3">{item.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function HabitBoard() {
  return (
    <div className="w-full max-w-[420px] rounded-2xl border border-rule bg-white p-6">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[15px] font-medium">
          <CalendarCheckIcon size={18} /> Check-in diário
        </span>
        <span className="money text-[13px] text-ink-3">5/7</span>
      </div>
      <div className="mt-3 flex gap-1.5" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className={`h-2 flex-1 rounded-full ${i < 5 ? "bg-ink" : "bg-paper-2"}`} />
        ))}
      </div>
      <p className="mt-3 text-[14px] text-ink-2">Faltam 2 dias seguidos pra ganhar os pontos da semana.</p>
      <div className="mt-6 grid grid-cols-3 border-t border-rule pt-5 text-center">
        <div>
          <p className="money text-[22px] font-medium">12</p>
          <p className="mt-0.5 text-[12.5px] text-ink-3">dias registrando</p>
        </div>
        <div className="border-x border-rule">
          <p className="money text-[22px] font-medium">4</p>
          <p className="mt-0.5 text-[12.5px] text-ink-3">nível</p>
        </div>
        <div>
          <p className="money text-[22px] font-medium">1</p>
          <p className="mt-0.5 text-[12.5px] text-ink-3">giro na roleta</p>
        </div>
      </div>
    </div>
  );
}

// Objetos desenhados que o editor pode pôr ao lado de cada faixa.
const VISUALS: Record<LandingBlockData<"productRows">["rows"][number]["visual"], React.ReactNode> = {
  receipt: (
    <div className="flex flex-col items-center justify-center gap-5 sm:flex-row">
      <Receipt />
      <ArrowRightIcon size={26} className="rotate-90 text-ink-3 sm:rotate-0" />
      <ParsedFields />
    </div>
  ),
  files: <StatementFiles />,
  habit: <HabitBoard />,
  none: null,
};

export function ProductRows({ data, anchor, ctx }: { data: LandingBlockData<"productRows">; anchor?: string; ctx: BlockContext }) {
  const Heading = ctx.headingLevel === 1 ? "h1" : "h2";
  return (
    <section id={anchor || undefined} aria-label="Recursos" className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 md:py-32">
      <Heading className="max-w-[720px] font-display text-[clamp(34px,4.4vw,52px)] font-extrabold leading-[1.05] tracking-[-0.025em] text-balance">
        {kern(data.title)}
      </Heading>
      <div className="mt-16 flex flex-col divide-y divide-rule border-y border-rule">
        {data.rows.map((row, i) => (
          <article key={`${i}-${row.title}`} className="flex flex-col gap-10 py-14 md:flex-row md:items-center md:gap-16">
            <div className={row.visual === "none" ? "max-w-[720px]" : "md:w-[44%]"}>
              <h3 className="font-display text-[clamp(26px,2.6vw,32px)] font-bold leading-[1.15] tracking-[-0.015em] text-balance">
                {kern(row.title)}
              </h3>
              {row.body && <p className="mt-4 max-w-[480px] text-[17px] leading-[1.65] text-ink-2">{row.body}</p>}
              {row.note && <p className="mt-4 text-[14px] text-ink-3">{row.note}</p>}
            </div>
            {row.visual !== "none" && <div className="flex flex-1 justify-center">{VISUALS[row.visual]}</div>}
          </article>
        ))}
      </div>
    </section>
  );
}
