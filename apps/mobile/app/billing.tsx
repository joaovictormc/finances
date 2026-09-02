import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Clipboard from "expo-clipboard";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";
import { formatBRL } from "@/lib/format";
import type {
  AvailablePaymentMethods,
  BillingInterval,
  PixCheckout,
  PlanDefinition,
  PlanId,
  PlanPrice,
  Subscription,
} from "@/lib/types";

/** Como o valor é escrito no card. "/mensal" soaria errado. */
const PERIOD_SUFFIX: Record<BillingInterval, string> = {
  monthly: "/mês",
  semiannual: "/semestre",
  annual: "/ano",
};

const INTERVAL_ORDER: BillingInterval[] = ["monthly", "semiannual", "annual"];

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

export default function BillingScreen() {
  const { colors } = useTheme();
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<AvailablePaymentMethods>({ mercadopago: false, pix: false });
  const [loading, setLoading] = useState(true);
  const [actionPlan, setActionPlan] = useState<PlanId | null>(null);
  const [pixCheckout, setPixCheckout] = useState<PixCheckout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>("monthly");

  const load = useCallback(() => {
    Promise.all([
      api.get<PlanDefinition[]>("/api/billing/plans"),
      api.get<Subscription>("/api/billing/subscription"),
      api.get<AvailablePaymentMethods>("/api/billing/payment-methods"),
    ])
      .then(([p, s, pm]) => {
        setPlans(p);
        // Abrir no mensal quando o admin o desativou mostraria tudo indisponível.
        const available = p.flatMap((plan) => plan.prices).map((price) => price.interval);
        if (available.length > 0 && !available.includes("monthly")) {
          setSelectedInterval(available[0]!);
        }
        setSubscription(s);
        setPaymentMethods(pm);
      })
      .catch(() => setError("Erro ao carregar planos."))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  async function handleUpgrade(plan: PlanId) {
    setError(null);
    setActionPlan(plan);
    try {
      const { checkoutUrl } = await api.post<{ checkoutUrl: string }>("/api/billing/checkout", {
        plan,
        interval: selectedInterval,
      });
      await WebBrowser.openBrowserAsync(checkoutUrl);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar checkout.");
    } finally {
      setActionPlan(null);
    }
  }

  async function handlePix(plan: PlanId) {
    setError(null);
    setActionPlan(plan);
    try {
      const data = await api.post<PixCheckout>("/api/billing/checkout-pix", {
        plan,
        interval: selectedInterval,
      });
      setPixCheckout(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar Pix.");
    } finally {
      setActionPlan(null);
    }
  }

  function handleCancel() {
    Alert.alert("Cancelar assinatura", "Você volta para o plano Free no fim do período atual. Continuar?", [
      { text: "Voltar", style: "cancel" },
      {
        text: "Cancelar assinatura",
        style: "destructive",
        onPress: async () => {
          setActionPlan(subscription?.plan ?? null);
          try {
            await api.post("/api/billing/cancel", {});
            load();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao cancelar assinatura.");
          } finally {
            setActionPlan(null);
          }
        },
      },
    ]);
  }

  async function handleCopyPix() {
    if (!pixCheckout) return;
    await Clipboard.setStringAsync(pixCheckout.payload);
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Só períodos que ao menos um plano pago oferece — desativado no admin some daqui.
  const intervalOptions = INTERVAL_ORDER.map((value) => {
    const match = plans.flatMap((plan) => plan.prices).find((price) => price.interval === value);
    return match ? { interval: value, label: match.label } : null;
  }).filter((option): option is { interval: BillingInterval; label: string } => option !== null);

  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark" contentContainerStyle={{ padding: 16, gap: 12 }}>
      {pixCheckout && (
        <View className="mb-2 items-center gap-3 rounded-2xl border border-primary bg-card p-5 dark:border-primary-dark dark:bg-card-dark">
          <Text className="text-lg font-bold text-foreground dark:text-foreground-dark">
            {formatBRL(pixCheckout.amount)}
          </Text>
          <Text className="text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
            Copie o código abaixo e pague no app do seu banco (Pix copia e cola)
          </Text>
          <View className="w-full rounded-md border border-border bg-muted p-3 dark:border-border-dark dark:bg-muted-dark">
            <Text className="text-xs text-foreground dark:text-foreground-dark" selectable numberOfLines={4}>
              {pixCheckout.payload}
            </Text>
          </View>
          <Pressable
            onPress={handleCopyPix}
            className="w-full items-center rounded-md border border-primary py-3 dark:border-primary-dark"
          >
            <Text className="text-sm font-medium text-primary dark:text-primary-dark">Copiar código Pix</Text>
          </Pressable>
          <Text className="text-center text-xs text-muted-foreground dark:text-muted-foreground-dark">
            Após o pagamento, nossa equipe confirma manualmente e seu plano é ativado em breve.
          </Text>
          <Pressable onPress={() => setPixCheckout(null)}>
            <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">Fechar</Text>
          </Pressable>
        </View>
      )}

      {intervalOptions.length > 1 && (
        <View className="mb-1 flex-row rounded-xl border border-border bg-muted p-1 dark:border-border-dark dark:bg-muted-dark">
          {intervalOptions.map((option) => {
            const active = selectedInterval === option.interval;
            return (
              <Pressable
                key={option.interval}
                onPress={() => setSelectedInterval(option.interval)}
                className={`flex-1 items-center rounded-lg py-2 ${active ? "bg-card dark:bg-card-dark" : ""}`}
              >
                <Text
                  className={`text-sm font-medium ${
                    active
                      ? "text-foreground dark:text-foreground-dark"
                      : "text-muted-foreground dark:text-muted-foreground-dark"
                  }`}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {plans.map((plan) => {
        const isCurrent = subscription?.plan === plan.id;
        const price = plan.prices.find((entry) => entry.interval === selectedInterval);
        const monthlyCents = plan.prices.find((entry) => entry.interval === "monthly")?.priceCents;
        const discount = price ? discountPercent(price, monthlyCents) : null;
        // Plano pago sem preço no período: o admin desativou esse período. Some
        // com o botão, mas mantém o card — esconder o plano confundiria mais.
        const unavailable = plan.id !== "free" && !price;
        return (
          <View
            key={plan.id}
            className={`rounded-2xl border bg-card p-5 dark:bg-card-dark ${
              isCurrent ? "border-primary dark:border-primary-dark" : "border-border dark:border-border-dark"
            }`}
          >
            <View className="mb-1 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-foreground dark:text-foreground-dark">{plan.name}</Text>
              {isCurrent && (
                <View className="rounded-full bg-primary/15 px-2 py-0.5">
                  <Text className="text-xs font-medium text-primary dark:text-primary-dark">Atual</Text>
                </View>
              )}
            </View>
            <View className="mb-4">
              {plan.id === "free" ? (
                <Text className="text-2xl font-bold text-foreground dark:text-foreground-dark">Grátis</Text>
              ) : price ? (
                <>
                  <Text className="text-2xl font-bold text-foreground dark:text-foreground-dark">
                    {formatBRL(price.priceCents / 100)}
                    <Text className="text-sm font-normal text-muted-foreground dark:text-muted-foreground-dark">
                      {PERIOD_SUFFIX[price.interval]}
                    </Text>
                  </Text>
                  {price.months > 1 && (
                    <Text className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                      {formatBRL(price.monthlyEquivalentCents / 100)} por mês
                      {discount !== null && (
                        <Text className="font-medium text-primary dark:text-primary-dark">
                          {` — economize ${discount}%`}
                        </Text>
                      )}
                    </Text>
                  )}
                </>
              ) : (
                <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
                  Indisponível neste período
                </Text>
              )}
            </View>

            <View className="mb-4 gap-2">
              {planFeatures(plan).map((feature) => (
                <View key={feature} className="flex-row items-start gap-2">
                  <Ionicons name="checkmark" size={14} color="#22c55e" style={{ marginTop: 2 }} />
                  <Text className="flex-1 text-sm text-muted-foreground dark:text-muted-foreground-dark">{feature}</Text>
                </View>
              ))}
            </View>

            {isCurrent ? (
              plan.id !== "free" && subscription?.status === "active" ? (
                <Pressable
                  onPress={handleCancel}
                  disabled={actionPlan === plan.id}
                  className="items-center rounded-md border border-destructive py-3 dark:border-destructive-dark"
                >
                  {actionPlan === plan.id ? (
                    <ActivityIndicator color="#ef4444" />
                  ) : (
                    <Text className="text-sm font-medium text-destructive dark:text-destructive-dark">
                      Cancelar assinatura
                    </Text>
                  )}
                </Pressable>
              ) : (
                <View className="items-center rounded-md border border-border py-3 dark:border-border-dark">
                  <Text className="text-sm font-medium text-muted-foreground dark:text-muted-foreground-dark">
                    Plano atual
                  </Text>
                </View>
              )
            ) : plan.id === "free" ? (
              <View className="items-center rounded-md border border-border py-3 dark:border-border-dark">
                <Text className="text-sm font-medium text-muted-foreground dark:text-muted-foreground-dark">
                  Plano gratuito
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                {paymentMethods.mercadopago && !unavailable && (
                  <Pressable
                    onPress={() => handleUpgrade(plan.id)}
                    disabled={actionPlan === plan.id}
                    className="items-center rounded-md bg-primary py-3 dark:bg-primary-dark"
                  >
                    {actionPlan === plan.id ? (
                      <ActivityIndicator color="#1C1C1E" />
                    ) : (
                      <Text className="text-sm font-medium text-primary-foreground dark:text-primary-foreground-dark">
                        Assinar {plan.name}
                      </Text>
                    )}
                  </Pressable>
                )}
                {paymentMethods.pix && !unavailable && (
                  <Pressable
                    onPress={() => handlePix(plan.id)}
                    disabled={actionPlan === plan.id}
                    className="items-center rounded-md border border-primary py-3 dark:border-primary-dark"
                  >
                    <Text className="text-sm font-medium text-primary dark:text-primary-dark">Pagar com Pix</Text>
                  </Pressable>
                )}
                {(unavailable || (!paymentMethods.mercadopago && !paymentMethods.pix)) && (
                  <View className="items-center rounded-md border border-border py-3 dark:border-border-dark">
                    <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
                      {unavailable ? "Escolha outro período" : "Checkout indisponível"}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}

      {subscription?.status === "pending" && (
        <Text className="text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
          Sua assinatura está pendente de confirmação do pagamento.
        </Text>
      )}
      {subscription?.canceledAt && (
        <Text className="text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
          Assinatura cancelada — acesso ao plano pago continua até o fim do período já pago.
        </Text>
      )}
      {error && <Text className="text-center text-sm text-destructive dark:text-destructive-dark">{error}</Text>}
    </ScrollView>
  );
}
