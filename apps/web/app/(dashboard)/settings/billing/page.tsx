"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/ui/back-button";
import { Drawer } from "@/components/ui/drawer";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-provider";
import { api } from "@/lib/api-client";
import { formatBRL } from "@/lib/utils";

type PlanId = "free" | "pro" | "familia";
type Interval = "monthly" | "semiannual" | "annual";

/** Como o valor é escrito no card. "/mensal" soaria errado. */
const PERIOD_SUFFIX: Record<Interval, string> = {
  monthly: "/mês",
  semiannual: "/semestre",
  annual: "/ano",
};

interface PlanPrice {
  interval: Interval;
  label: string;
  months: number;
  priceCents: number;
  monthlyEquivalentCents: number;
}

interface PlanDefinition {
  id: PlanId;
  name: string;
  priceCents: number;
  /** Um item por período habilitado no admin; vazio no plano Free. */
  prices: PlanPrice[];
  maxBankConnections: number | null;
  historyMonths: number | null;
  aiInsights: boolean;
  assistant: boolean;
  maxGroupMembers: number;
}

interface Subscription {
  plan: PlanId;
  status: string;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
}

interface AvailablePaymentMethods {
  mercadopago: boolean;
  pix: boolean;
}

interface PixCheckout {
  payload: string;
  txid: string;
  amount: number;
}

/** Economia do período em relação a pagar o mensal N vezes. */
function discountPercent(price: PlanPrice, monthlyCents: number | undefined): number | null {
  if (price.months <= 1 || !monthlyCents) return null;
  const full = monthlyCents * price.months;
  if (price.priceCents >= full) return null;
  return Math.round((1 - price.priceCents / full) * 100);
}

function planFeatures(plan: PlanDefinition): string[] {
  return [
    plan.maxBankConnections === null ? "Conexões bancárias ilimitadas" : `${plan.maxBankConnections} conexão bancária`,
    plan.historyMonths === null ? "Histórico completo" : `${plan.historyMonths} meses de histórico`,
    plan.assistant ? "Assistente de IA com agentes personalizados" : "Sem assistente de IA",
    plan.aiInsights ? "Insights e IA conversacional" : "Sem insights de IA",
    plan.maxGroupMembers > 1 ? `Família até ${plan.maxGroupMembers} membros` : "Sem compartilhamento familiar",
  ];
}

export default function BillingPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<AvailablePaymentMethods>({ mercadopago: false, pix: false });
  const [isLoading, setIsLoading] = useState(true);
  const [actionPlan, setActionPlan] = useState<PlanId | null>(null);
  const [pixCheckout, setPixCheckout] = useState<PixCheckout | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<Interval>("monthly");

  useEffect(() => {
    Promise.all([
      api.get<PlanDefinition[]>("/api/billing/plans"),
      api.get<Subscription>("/api/billing/subscription"),
      api.get<AvailablePaymentMethods>("/api/billing/payment-methods"),
    ])
      .then(([p, s, pm]) => {
        setPlans(p);
        const available = p.flatMap((plan) => plan.prices).map((price) => price.interval);
        if (available.length > 0 && !available.includes("monthly")) {
          setSelectedInterval(available[0]!);
        }
        setSubscription(s);
        setPaymentMethods(pm);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleUpgrade = async (plan: PlanId) => {
    if (plan === "free") return;
    setActionPlan(plan);
    try {
      const { checkoutUrl } = await api.post<{ checkoutUrl: string }>("/api/billing/checkout", {
        plan,
        interval: selectedInterval,
      });
      window.location.href = checkoutUrl;
    } catch {
      toast({ title: "Erro ao iniciar checkout", variant: "error" });
      setActionPlan(null);
    }
  };

  const handlePix = async (plan: PlanId) => {
    if (plan === "free") return;
    setActionPlan(plan);
    try {
      const data = await api.post<PixCheckout>("/api/billing/checkout-pix", { plan, interval: selectedInterval });
      setPixCheckout(data);
    } catch (err) {
      toast({ title: (err as Error).message || "Erro ao gerar Pix", variant: "error" });
    } finally {
      setActionPlan(null);
    }
  };

  const handleCancel = async () => {
    if (!(await confirm("Cancelar sua assinatura? Você volta para o plano Free no fim do período atual."))) return;
    setActionPlan(subscription?.plan ?? null);
    try {
      await api.post("/api/billing/cancel", {});
      toast({ title: "Assinatura cancelada", variant: "success" });
      const s = await api.get<Subscription>("/api/billing/subscription");
      setSubscription(s);
    } catch {
      toast({ title: "Erro ao cancelar assinatura", variant: "error" });
    } finally {
      setActionPlan(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const intervalOptions = (["monthly", "semiannual", "annual"] as Interval[])
    .map((value) => {
      const match = plans.flatMap((plan) => plan.prices).find((price) => price.interval === value);
      return match ? { interval: value, label: match.label } : null;
    })
    .filter((option): option is { interval: Interval; label: string } => option !== null);

  return (
    <div>
      <BackButton href="/settings" label="Configurações" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Planos e Assinatura</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Escolha o plano que melhor se encaixa nas suas finanças
        </p>
      </div>

      {intervalOptions.length > 1 && (
        <div className="mb-6 inline-flex rounded-xl border border-border/60 bg-muted/40 p-1">
          {intervalOptions.map((option) => (
            <button
              key={option.interval}
              type="button"
              onClick={() => setSelectedInterval(option.interval)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                selectedInterval === option.interval
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = subscription?.plan === plan.id;
          const price = plan.prices.find((entry) => entry.interval === selectedInterval);
          const monthlyCents = plan.prices.find((entry) => entry.interval === "monthly")?.priceCents;
          const discount = price ? discountPercent(price, monthlyCents) : null;
          // Plano pago sem preço no período escolhido: o admin desativou esse
          // período. Mostrar o card sem poder assinar é mais honesto do que
          // sumir com o plano da lista.
          const unavailable = plan.id !== "free" && !price;
          return (
            <div
              key={plan.id}
              className={`bg-card rounded-2xl border p-6 shadow-sm flex flex-col ${
                isCurrent ? "border-primary ring-1 ring-primary/30" : "border-border/60"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-semibold">{plan.name}</h2>
                {isCurrent && <Badge variant="success">Atual</Badge>}
              </div>
              <div className="mb-4">
                {plan.id === "free" ? (
                  <p className="text-2xl font-bold">Grátis</p>
                ) : price ? (
                  <>
                    <p className="text-2xl font-bold">
                      {formatBRL(price.priceCents / 100)}
                      <span className="text-sm font-normal text-muted-foreground">
                        {PERIOD_SUFFIX[price.interval]}
                      </span>
                    </p>
                    {price.months > 1 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatBRL(price.monthlyEquivalentCents / 100)} por mês
                        {discount !== null && (
                          <span className="ml-1 font-medium text-primary">
                            — economize {discount}%
                          </span>
                        )}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Indisponível neste período</p>
                )}
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {planFeatures(plan).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check size={14} className="text-success mt-0.5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                plan.id !== "free" && subscription?.status === "active" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    loading={actionPlan === plan.id}
                  >
                    Cancelar assinatura
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Plano atual
                  </Button>
                )
              ) : plan.id === "free" ? (
                <Button variant="outline" size="sm" disabled>
                  Plano gratuito
                </Button>
              ) : (
                <div className="flex flex-col gap-2">
                  {paymentMethods.mercadopago && (
                    <Button
                      size="sm"
                      onClick={() => handleUpgrade(plan.id)}
                      loading={actionPlan === plan.id}
                      disabled={unavailable}
                    >
                      Assinar {plan.name}
                    </Button>
                  )}
                  {paymentMethods.pix && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePix(plan.id)}
                      loading={actionPlan === plan.id}
                      disabled={unavailable}
                    >
                      Pagar com Pix
                    </Button>
                  )}
                  {!paymentMethods.mercadopago && !paymentMethods.pix && (
                    <Button size="sm" disabled>
                      Checkout indisponível
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {subscription?.status === "pending" && (
        <p className="text-sm text-muted-foreground mt-4">
          Sua assinatura está pendente de confirmação do pagamento.
        </p>
      )}
      {subscription?.status === "past_due" && (
        <p className="text-sm text-muted-foreground mt-4">
          O período pago da sua assinatura terminou. Renove para voltar a ter acesso ao plano.
        </p>
      )}
      {subscription?.canceledAt && (
        <p className="text-sm text-muted-foreground mt-4">
          Assinatura cancelada — o acesso ao plano pago já foi encerrado.
        </p>
      )}

      <Drawer open={!!pixCheckout} onClose={() => setPixCheckout(null)} title="Pagar com Pix">
        {pixCheckout && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-2xl font-bold">{formatBRL(pixCheckout.amount)}</p>
            <div className="bg-white p-3 rounded-xl">
              <QRCode value={pixCheckout.payload} size={200} />
            </div>
            <p className="text-sm text-muted-foreground">
              Escaneie o QR code com o app do seu banco ou copie o código abaixo
            </p>
            <textarea
              readOnly
              value={pixCheckout.payload}
              rows={4}
              className="w-full rounded-md border border-border bg-muted p-2 text-xs font-mono text-foreground"
              onClick={(e) => e.currentTarget.select()}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(pixCheckout.payload);
                toast({ title: "Código Pix copiado", variant: "success" });
              }}
            >
              Copiar código Pix
            </Button>
            <p className="text-xs text-muted-foreground">
              Após o pagamento, nossa equipe confirma manualmente e seu plano é ativado em breve.
            </p>
          </div>
        )}
      </Drawer>
    </div>
  );
}
