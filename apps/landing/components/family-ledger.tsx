import type { LandingBlockData } from "@finances/validations";
import { kern } from "@/components/kern";
import { LedgerClose } from "./ledger-close";
import type { BlockContext } from "./block-context";

export function FamilyLedger({ data, anchor, ctx }: { data: LandingBlockData<"ledger">; anchor?: string; ctx: BlockContext }) {
  const Heading = ctx.headingLevel === 1 ? "h1" : "h2";
  const rows = data.rows;
  return (
    <section id={anchor || undefined} className="border-y border-rule bg-paper-2">
      <div className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 md:py-32">
        <div className="max-w-[640px]">
          <Heading className="font-display text-[clamp(34px,4.4vw,52px)] font-extrabold leading-[1.05] tracking-[-0.025em] text-balance">
            {kern(data.title)}
          </Heading>
          {data.body && <p className="mt-5 text-[18px] leading-[1.65] text-ink-2">{data.body}</p>}
        </div>

        <LedgerClose className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-14">
          <div className="rounded-2xl border border-rule bg-white px-5 pb-6 pt-6 shadow-[0_28px_56px_-40px_rgba(28,28,30,0.4)] sm:px-8">
            <table className="w-full border-collapse text-left">
              <caption className="pb-4 text-left">
                <span className="flex items-baseline justify-between gap-4 border-b-2 border-ink pb-3">
                  <span className="font-display text-[17px] font-bold">{data.sheetTitle}</span>
                  <span className="money text-[13px] text-ink-3">{data.period}</span>
                </span>
              </caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Lançamento</th>
                  <th scope="col">Quem lançou</th>
                  <th scope="col">Valor em reais</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={`${i}-${row.description}`}
                    className="ledger-row border-b border-rule"
                    style={{ "--row": i } as React.CSSProperties}
                  >
                    <td className="money hidden w-16 py-4 pr-4 text-[13px] text-ink-3 sm:table-cell">{row.date}</td>
                    <td className="py-4 pr-4 text-[15.5px]">{row.description}</td>
                    <td className="py-4 pr-4">
                      <span className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper-2 text-[11px] font-semibold text-ink-2"
                        >
                          {row.initials}
                        </span>
                        <span className="hidden text-[14px] text-ink-2 md:inline">
                          {row.name}
                          {row.role && <span className="text-ink-3"> · {row.role}</span>}
                        </span>
                        <span className="sr-only md:hidden">{row.name}</span>
                      </span>
                    </td>
                    <td className={`money py-4 text-right text-[15.5px] ${row.income ? "text-azul" : ""}`}>{row.amount}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="ledger-row" style={{ "--row": rows.length } as React.CSSProperties}>
                  {/* Régua dupla sobre o total: o fechamento contábil do extrato. */}
                  <th scope="row" colSpan={2} className="border-t-[3px] border-double border-ink pt-5 align-top text-[16px] font-semibold">
                    {data.totalLabel}
                  </th>
                  <td aria-hidden="true" className="hidden border-t-[3px] border-double border-ink sm:table-cell" />
                  <td className="border-t-[3px] border-double border-ink pt-5 text-right align-top">
                    <span
                      className={`money block text-[clamp(24px,3vw,32px)] font-medium leading-none ${
                        data.totalAmount.trim().startsWith("+") ? "text-azul" : ""
                      }`}
                    >
                      {data.totalAmount}
                    </span>
                    {data.totalMarker && (
                      <span className="ledger-total-marker marker mt-2 inline-block text-[15px] font-semibold">{data.totalMarker}</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
            <p className="mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-rule pt-4 text-[13.5px] text-ink-2">
              <span>{data.footer}</span>
              <span className="text-[12.5px] text-ink-3">Valores de exemplo</span>
            </p>
          </div>

          {data.notes.length > 0 && (
            <aside aria-label="Atividade do grupo" className="lg:pt-14">
              {data.marginTitle && <p className="font-display text-[15px] font-bold">{data.marginTitle}</p>}
              <ol className="mt-5 flex flex-col gap-5">
                {data.notes.map((note, i) => (
                  <li
                    key={`${i}-${note.when}`}
                    className="ledger-row border-l border-ink-3/40 pl-4"
                    style={{ "--row": rows.length + 1 + i } as React.CSSProperties}
                  >
                    {note.when && <span className="money block text-[12.5px] text-ink-3">{note.when}</span>}
                    <span className="mt-1 block text-[15px] leading-[1.55] text-ink-2">{note.text}</span>
                  </li>
                ))}
              </ol>
            </aside>
          )}
        </LedgerClose>
      </div>
    </section>
  );
}
