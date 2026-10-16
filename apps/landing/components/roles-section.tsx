import type { LandingBlockData } from "@finances/validations";
import { kern } from "@/components/kern";
import { CheckIcon, DashIcon } from "./icons";
import type { BlockContext } from "./block-context";

const ROLES = ["Dono", "Administrador", "Membro", "Visualizador"] as const;

// Conferido nas rotas da API (hasGroupRole / getGroupRole em apps/api).
const PERMISSIONS: { label: string; allowed: [boolean, boolean, boolean, boolean] }[] = [
  { label: "Ver tudo o que é do grupo", allowed: [true, true, true, true] },
  { label: "Lançar gastos, criar orçamentos e metas", allowed: [true, true, true, false] },
  { label: "Editar e excluir o que é do grupo", allowed: [true, true, false, false] },
  { label: "Convidar e remover pessoas", allowed: [true, true, false, false] },
  { label: "Mudar papéis e excluir o grupo", allowed: [true, false, false, false] },
];

/** Primeira frase em negrito: o fato principal da nota lê primeiro. */
function leadSentence(text: string) {
  const match = text.match(/^([\s\S]+?[.!?])\s+([\s\S]*)$/);
  if (!match) return <strong className="font-semibold text-night-ink">{text}</strong>;
  return (
    <>
      <strong className="font-semibold text-night-ink">{match[1]}</strong> {match[2]}
    </>
  );
}

// A tabela de permissões vem do código, não do editor: é fato do produto
// (rotas da API), e um texto editável poderia prometer o que não existe.
export function RolesSection({ data, anchor, ctx }: { data: LandingBlockData<"roles">; anchor?: string; ctx: BlockContext }) {
  const Heading = ctx.headingLevel === 1 ? "h1" : "h2";
  return (
    <section id={anchor || undefined} className="on-night bg-night text-night-ink">
      <div className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 md:py-32">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div>
            <Heading className="font-display text-[clamp(34px,4.4vw,52px)] font-extrabold leading-[1.05] tracking-[-0.025em] text-balance">
              {kern(data.title)}
            </Heading>
            {data.body && <p className="mt-5 max-w-[460px] text-[18px] leading-[1.65] text-night-ink-2">{data.body}</p>}
            {data.note && (
              <p className="mt-8 max-w-[460px] border-t border-night-rule pt-6 text-[15.5px] leading-[1.65] text-night-ink-2">
                {leadSentence(data.note)}
              </p>
            )}
          </div>

          {/* Celular: uma linha por papel com o que ele pode — a tabela de 4
              colunas não cabe em 390px sem esconder dois papéis. */}
          <ul className="flex flex-col border-t border-night-rule sm:hidden">
            {ROLES.map((role, r) => (
              <li key={role} className="border-b border-night-rule py-5">
                <p className="font-display text-[17px] font-bold">{role}</p>
                <ul className="mt-2.5 flex flex-col gap-1.5">
                  {PERMISSIONS.filter((p) => p.allowed[r]).map((p) => (
                    <li key={p.label} className="flex items-start gap-2.5 text-[15px] leading-snug text-night-ink-2">
                      <CheckIcon size={17} className="mt-0.5 shrink-0 text-night-ink" />
                      {p.label}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-2xl border border-night-rule sm:block">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <caption className="sr-only">Permissões de cada papel no grupo</caption>
              <thead>
                <tr className="border-b border-night-rule">
                  <th scope="col" className="px-5 py-4 text-[13px] font-medium text-night-ink-2">
                    O que pode fazer
                  </th>
                  {ROLES.map((role) => (
                    <th key={role} scope="col" className="px-3 py-4 text-center font-display text-[14px] font-bold">
                      {role}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((row) => (
                  <tr key={row.label} className="border-b border-night-rule last:border-b-0">
                    <th scope="row" className="px-5 py-4 text-[15px] font-normal leading-snug text-night-ink">
                      {row.label}
                    </th>
                    {row.allowed.map((allowed, i) => (
                      <td key={ROLES[i]} className="px-3 py-4 text-center">
                        {allowed ? (
                          <CheckIcon size={20} className="mx-auto text-night-ink" />
                        ) : (
                          <DashIcon size={20} className="mx-auto text-[#75757d]" />
                        )}
                        <span className="sr-only">{allowed ? "Pode" : "Não pode"}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
