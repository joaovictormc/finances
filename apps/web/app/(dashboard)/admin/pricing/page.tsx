"use client";

import { useCallback, useEffect, useState } from "react";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";

type PlanId = "pro" | "familia";
type Interval = "monthly" | "semiannual" | "annual";

type PlanPriceRow = {
  plan: PlanId;
  interval: Interval;
  priceCents: number;
  active: boolean;
  label: string;
  months: number;
};

const PLAN_NAMES: Record<PlanId, string> = { pro: "Pro", familia: "Família" };
const PLAN_ORDER: PlanId[] = ["pro", "familia"];

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Desconto do período em relação a pagar o mensal N vezes. É o número que
 * responde "vale a pena pro cliente?" sem o admin abrir a calculadora.
 */
function discountPercent(row: PlanPriceRow, monthlyCents: number): number | null {
  if (row.months <= 1 || monthlyCents <= 0) return null;
  const full = monthlyCents * row.months;
  if (row.priceCents >= full) return null;
  return Math.round((1 - row.priceCents / full) * 100);
}

export default function AdminPricingPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<PlanPriceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setRows(await api.get<PlanPriceRow[]>("/api/admin/plan-prices"));
    } catch {
      toast({ title: "Erro ao carregar os preços", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (plan: PlanId, interval: Interval, patch: Partial<PlanPriceRow>) => {
    setRows((current) =>
      current.map((row) =>
        row.plan === plan && row.interval === interval ? { ...row, ...patch } : row,
      ),
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await api.patch<PlanPriceRow[]>("/api/admin/plan-prices", {
        prices: rows.map(({ plan, interval, priceCents, active }) => ({
          plan,
          interval,
          priceCents,
          active,
        })),
      });
      setRows(saved);
      toast({ title: "Preços atualizados", variant: "success" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Erro ao salvar os preços",
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <BackButton href="/admin" label="Administração" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Precificação</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Defina o valor de cada plano por período de cobrança
        </p>
      </div>

      <p className="mb-6 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        O preço novo vale para <strong className="text-foreground">checkouts a partir daqui</strong>.
        Quem já assina continua no valor que contratou — o Mercado Pago fixa o valor da assinatura
        no momento em que ela é criada. Desativar um período apenas o esconde do checkout; o preço
        configurado fica guardado.
      </p>

      <div className="space-y-6">
        {PLAN_ORDER.map((plan) => {
          const planRows = rows.filter((row) => row.plan === plan);
          const monthlyCents = planRows.find((row) => row.interval === "monthly")?.priceCents ?? 0;

          return (
            <section key={plan} className="bg-card rounded-2xl border border-border/60 shadow-sm p-5">
              <h2 className="text-base font-semibold text-foreground mb-4">
                Plano {PLAN_NAMES[plan]}
              </h2>

              <div className="space-y-4">
                {planRows.map((row) => {
                  const discount = discountPercent(row, monthlyCents);
                  const perMonth = row.months > 0 ? Math.round(row.priceCents / row.months) : 0;

                  return (
                    <div
                      key={row.interval}
                      className="flex flex-wrap items-end gap-4 border-b border-border pb-4 last:border-0 last:pb-0"
                    >
                      <div className="w-40 shrink-0">
                        <p className="text-sm font-medium text-foreground">{row.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {row.months} {row.months === 1 ? "mês" : "meses"}
                        </p>
                      </div>

                      <div className="w-44">
                        <CurrencyInput
                          label="Total do período"
                          value={row.priceCents}
                          onChange={(cents) => update(plan, row.interval, { priceCents: cents })}
                        />
                      </div>

                      <div className="min-w-32 flex-1 pb-2">
                        <p className="text-xs text-muted-foreground">
                          {formatBRL(perMonth)}/mês
                        </p>
                        {discount !== null && (
                          <p className="text-xs font-medium text-primary mt-0.5">
                            {discount}% de desconto
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => update(plan, row.interval, { active: !row.active })}
                        aria-label={row.active ? "Desativar período" : "Ativar período"}
                        className={`relative mb-2 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                          row.active ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            row.active ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Salvando..." : "Salvar preços"}
        </Button>
      </div>
    </div>
  );
}
