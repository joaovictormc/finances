"use client";

import { useEffect, useState } from "react";
import { CheckIcon, DashIcon } from "./icons";
import { SIGNUP_URL } from "@/lib/links";
import { PLANS_ENDPOINT, formatCents, type Interval, type Plan } from "@/lib/plans";

const INTERVAL_ORDER: Interval[] = ["monthly", "semiannual", "annual"];
const INTERVAL_SHORT: Record<Interval, string> = { monthly: "Mensal", semiannual: "Semestral", annual: "Anual" };

type Cell = boolean | string;

// Linhas da comparação, derivadas dos campos que a API expõe (que espelham
// apps/api/src/lib/plans.ts) — nenhum recurso escrito à mão por plano.
const FEATURES: { label: string; value: (plan: Plan) => Cell }[] = [
  {
    label: "Histórico",
    value: (p) => (p.historyMonths === null ? "Completo" : `Últimos ${p.historyMonths} meses`),
  },
  { label: "Transações, orçamentos, metas e contas a pagar", value: () => true },
  { label: "Importar extrato OFX e CSV", value: () => true },
  { label: "Assistente e insights com IA", value: (p) => p.assistant },
  { label: "Leitura de cupom pelo app", value: (p) => p.receiptScan },
  {
    label: "Grupo familiar com papéis",
    value: (p) => (p.maxGroupMembers > 1 ? `Até ${p.maxGroupMembers} pessoas` : false),
  },
];

function priceFor(plan: Plan, interval: Interval) {
  if (plan.id === "free") return { main: "R$ 0", sub: "para sempre" };
  const price = plan.prices.find((p) => p.interval === interval);
  if (!price) return null;
  if (price.months === 1) return { main: formatCents(price.priceCents), sub: "por mês" };
  return {
    main: formatCents(price.monthlyEquivalentCents),
    sub: `por mês · ${formatCents(price.priceCents)} a cada ${price.months} meses`,
  };
}

function CellValue({ value, night }: { value: Cell; night?: boolean }) {
  if (value === true)
    return (
      <>
        <CheckIcon size={19} className={night ? "text-night-ink" : "text-ink"} />
        <span className="sr-only">Incluído</span>
      </>
    );
  if (value === false)
    return (
      <>
        <DashIcon size={19} className="text-[#8a8a91]" />
        <span className="sr-only">Não incluído</span>
      </>
    );
  return <span className="text-[14.5px]">{value}</span>;
}

export function Pricing({ initialPlans, footnote }: { initialPlans: Plan[] | null; footnote: string }) {
  const [plans, setPlans] = useState(initialPlans);
  const [period, setPeriod] = useState<Interval>("monthly");

  // O HTML veio com os preços do build; aqui confere os atuais (o admin pode
  // ter reajustado depois do deploy).
  useEffect(() => {
    let active = true;
    fetch(PLANS_ENDPOINT)
      .then((res) => (res.ok ? (res.json() as Promise<Plan[]>) : null))
      .then((fresh) => {
        if (active && fresh) setPlans(fresh);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const intervals = INTERVAL_ORDER.filter((i) =>
    (plans ?? []).some((p) => p.prices.some((price) => price.interval === i))
  );

  if (!plans) {
    return (
      <p className="mt-10 rounded-2xl border border-rule bg-white px-6 py-8 text-[16px] text-ink-2">
        Não conseguimos carregar os planos agora.{" "}
        <a href={SIGNUP_URL} className="font-medium text-ink underline">
          Crie sua conta grátis
        </a>{" "}
        e veja os planos dentro do app.
      </p>
    );
  }

  return (
    <div className="mt-10">
      {intervals.length > 1 && (
        <div role="radiogroup" aria-label="Período de cobrança" className="inline-flex rounded-xl border border-rule bg-white p-1">
          {intervals.map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={period === i}
              onClick={() => setPeriod(i)}
              className={`min-h-10 rounded-lg px-4 text-[14.5px] font-medium transition-colors duration-200 ${
                period === i ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"
              }`}
            >
              {INTERVAL_SHORT[i]}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-3 lg:gap-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-rule">
        {plans.map((plan, index) => {
          const featured = plan.id === "familia";
          const price = priceFor(plan, period);
          return (
            <article
              key={plan.id}
              className={`flex flex-col rounded-2xl border p-7 lg:rounded-none lg:border-0 ${
                featured
                  ? "on-night border-night bg-night text-night-ink"
                  : `border-rule bg-white ${index > 0 ? "lg:border-l lg:border-rule" : ""}`
              }`}
            >
              <h3 className="font-display text-[22px] font-bold">{plan.name}</h3>
              <p className={`mt-1 text-[14.5px] ${featured ? "text-night-ink-2" : "text-ink-3"}`}>
                {plan.id === "free" && "Pra começar a organizar sozinho."}
                {plan.id === "pro" && "Tudo pra você, com IA e histórico completo."}
                {plan.id === "familia" && "O Pro para a casa inteira, em grupo."}
              </p>

              <div className="mt-6 min-h-[76px]">
                {price ? (
                  <>
                    <p className="money text-[36px] font-medium leading-none">{price.main}</p>
                    <p className={`mt-2 text-[13.5px] ${featured ? "text-night-ink-2" : "text-ink-3"}`}>{price.sub}</p>
                  </>
                ) : (
                  <p className={`text-[14.5px] ${featured ? "text-night-ink-2" : "text-ink-3"}`}>
                    Período indisponível neste plano.
                  </p>
                )}
              </div>

              <a
                href={SIGNUP_URL}
                className={`mt-6 flex min-h-12 items-center justify-center rounded-xl text-[15.5px] font-semibold transition-[transform,box-shadow] duration-200 hover:-translate-y-px ${
                  featured
                    ? "bg-marker text-ink hover:shadow-[0_10px_24px_-12px_rgba(255,195,0,0.7)]"
                    : "border border-ink text-ink hover:shadow-[0_8px_20px_-14px_rgba(28,28,30,0.5)]"
                }`}
              >
                {plan.id === "free" ? "Criar conta grátis" : `Começar com o ${plan.name}`}
              </a>

              <ul className={`mt-8 flex flex-col divide-y ${featured ? "divide-night-rule" : "divide-rule"}`}>
                {FEATURES.map((feature) => (
                  <li key={feature.label} className="flex items-center justify-between gap-4 py-3">
                    <span className={`text-[14.5px] leading-snug ${featured ? "text-night-ink-2" : "text-ink-2"}`}>
                      {feature.label}
                    </span>
                    <span className="shrink-0">
                      <CellValue value={feature.value(plan)} night={featured} />
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
      {footnote && <p className="mt-5 text-[14px] text-ink-3">{footnote}</p>}
    </div>
  );
}
