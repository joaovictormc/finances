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

interface PlanDefinition {
  id: PlanId;
  name: string;
  priceCents: number;
  maxBankConnections: number | null;
  historyMonths: number | null;
  channels: Array<"telegram" | "whatsapp">;
  aiInsights: boolean;
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

function planFeatures(plan: PlanDefinition): string[] {
  return [
    plan.maxBankConnections === null ? "Conexões bancárias ilimitadas" : `${plan.maxBankConnections} conexão bancária`,
    plan.historyMonths === null ? "Histórico completo" : `${plan.historyMonths} meses de histórico`,
    plan.channels.includes("whatsapp") ? "Telegram + WhatsApp" : "Telegram",
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

  useEffect(() => {
    Promise.all([
      api.get<PlanDefinition[]>("/api/billing/plans"),
      api.get<Subscription>("/api/billing/subscription"),
      api.get<AvailablePaymentMethods>("/api/billing/payment-methods"),
    ])
      .then(([p, s, pm]) => {
        setPlans(p);
        setSubscription(s);
        setPaymentMethods(pm);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleUpgrade = async (plan: PlanId) => {
    if (plan === "free") return;
    setActionPlan(plan);
    try {
      const { checkoutUrl } = await api.post<{ checkoutUrl: string }>("/api/billing/checkout", { plan });
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
      const data = await api.post<PixCheckout>("/api/billing/checkout-pix", { plan });
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

  return (
    <div>
      <BackButton href="/settings" label="Configurações" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Planos e Assinatura</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Escolha o plano que melhor se encaixa nas suas finanças
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = subscription?.plan === plan.id;
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
              <p className="text-2xl font-bold mb-4">
                {plan.priceCents === 0 ? "Grátis" : formatBRL(plan.priceCents / 100)}
                {plan.priceCents > 0 && <span className="text-sm font-normal text-muted-foreground">/mês</span>}
              </p>
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
                    <Button size="sm" onClick={() => handleUpgrade(plan.id)} loading={actionPlan === plan.id}>
                      Assinar {plan.name}
                    </Button>
                  )}
                  {paymentMethods.pix && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePix(plan.id)}
                      loading={actionPlan === plan.id}
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
      {subscription?.canceledAt && (
        <p className="text-sm text-muted-foreground mt-4">
          Assinatura cancelada — acesso ao plano pago continua até o fim do período já pago.
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
