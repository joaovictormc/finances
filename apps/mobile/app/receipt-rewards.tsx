import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, Platform } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ReceiptRewardStatus } from "@finances/validations";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";
import { formatDate } from "@/lib/format";
import { FormScrollView } from "@/components/form-scroll-view";
import { takePendingReceiptCode } from "@/lib/nfce";

const MODEL_LABEL: Record<string, string> = { "65": "NFC-e", "59": "SAT" };

function monthLabel(issuedMonth: string) {
  const [year, month] = issuedMonth.split("-");
  return `${month}/${year}`;
}

export default function ReceiptRewardsScreen() {
  const { colors } = useTheme();
  const [status, setStatus] = useState<ReceiptRewardStatus | null>(null);
  const [loadError, setLoadError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      api
        .get<ReceiptRewardStatus>("/api/receipt-rewards")
        .then((data) => {
          setStatus(data);
          setLoadError(false);
        })
        .catch(() => setLoadError(true));
    }, [])
  );

  if (!status) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6 dark:bg-background-dark">
        {loadError ? (
          <Text className="text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
            Não foi possível carregar o programa agora.
          </Text>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  return (
    <FormScrollView className="flex-1 bg-background dark:bg-background-dark" contentContainerStyle={{ padding: 16, gap: 16 }}>
      {!status.enabled ? (
        <Card>
          <Text className="text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
            O programa de recompensa por cupom ainda não está ativo. Avisaremos quando abrir.
          </Text>
        </Card>
      ) : status.consent.active ? (
        <Participating status={status} onChange={setStatus} />
      ) : (
        <Terms status={status} onChange={setStatus} />
      )}
    </FormScrollView>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View className="rounded-2xl border border-border bg-card p-5 dark:border-border-dark dark:bg-card-dark">{children}</View>
  );
}

function TermsText({ status }: { status: ReceiptRewardStatus }) {
  return (
    <View className="gap-4">
      {status.terms.sections.map((section) => (
        <View key={section.heading}>
          <Text className="font-semibold text-foreground dark:text-foreground-dark">{section.heading}</Text>
          {section.body.map((paragraph, index) => (
            <Text key={index} className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground-dark">
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
      <Text className="font-mono text-xs text-muted-foreground dark:text-muted-foreground-dark">
        Versão do termo: {status.terms.version}
      </Text>
    </View>
  );
}

function Terms({ status, onChange }: { status: ReceiptRewardStatus; onChange: (s: ReceiptRewardStatus) => void }) {
  const { colors } = useTheme();
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  async function accept() {
    setSaving(true);
    try {
      onChange(await api.post<ReceiptRewardStatus>("/api/receipt-rewards/consent", { version: status.terms.version }));
    } catch (err) {
      Alert.alert("Não foi possível participar", err instanceof Error ? err.message : "Tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      {status.consent.outdated && (
        <Text className="mb-4 rounded-lg bg-primary/15 px-3 py-2 text-sm text-foreground dark:text-foreground-dark">
          O termo do programa mudou. Leia a versão nova e aceite para continuar enviando cupons.
        </Text>
      )}
      <Text className="mb-3 text-base font-semibold text-foreground dark:text-foreground-dark">Termo do programa</Text>
      <TermsText status={status} />
      <Pressable
        onPress={() => setAgreed(!agreed)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        className="mt-5 flex-row items-start gap-3"
      >
        <Ionicons name={agreed ? "checkbox" : "square-outline"} size={22} color={agreed ? colors.primary : colors.mutedForeground} />
        <Text className="flex-1 text-sm text-foreground dark:text-foreground-dark">
          Li e aceito o termo do programa de recompensa por cupom.
        </Text>
      </Pressable>
      <Pressable
        onPress={() => void accept()}
        disabled={!agreed || saving}
        className="mt-4 items-center rounded-md bg-primary py-3 dark:bg-primary-dark"
        style={{ opacity: !agreed || saving ? 0.5 : 1 }}
      >
        {saving ? (
          <ActivityIndicator color="#1C1C1E" />
        ) : (
          <Text className="font-semibold text-primary-foreground dark:text-primary-foreground-dark">Participar</Text>
        )}
      </Pressable>
    </Card>
  );
}

function Participating({ status, onChange }: { status: ReceiptRewardStatus; onChange: (s: ReceiptRewardStatus) => void }) {
  const { colors } = useTheme();
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const { rules, usage, totals } = status;
  const limitReached = usage.today >= rules.dailyLimit || usage.week >= rules.weeklyLimit;
  // A câmera do QR é nativa; no navegador segue colando o link ou a chave.
  const canScan = Platform.OS !== "web";

  // Volta da câmera com o link do QR já lido.
  useFocusEffect(
    useCallback(() => {
      const scanned = takePendingReceiptCode();
      if (scanned) setCode(scanned);
    }, [])
  );

  async function send() {
    setSending(true);
    try {
      const result = await api.post<{ points: number; uf: string; status: ReceiptRewardStatus }>("/api/receipt-rewards/receipts", {
        code,
      });
      onChange(result.status);
      setCode("");
      Alert.alert("Cupom aceito", `Cupom de ${result.uf}: +${result.points} pontos.`);
    } catch (err) {
      Alert.alert("Cupom não aceito", err instanceof Error ? err.message : "Tente de novo.");
    } finally {
      setSending(false);
    }
  }

  function leave() {
    Alert.alert(
      "Sair do programa",
      "Você não poderá mais enviar cupons até aceitar o termo de novo. Os pontos já ganhos continuam com você.",
      [
        { text: "Voltar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: async () => onChange(await api.delete<ReceiptRewardStatus>("/api/receipt-rewards/consent")),
        },
      ]
    );
  }

  return (
    <>
      <Card>
        <Text className="text-base font-semibold text-foreground dark:text-foreground-dark">Enviar cupom</Text>
        <Text className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground-dark">
          {canScan
            ? "Leia o QR Code impresso no cupom. Se ele estiver apagado, digite a chave de 44 dígitos que vem embaixo dele."
            : "Aponte a câmera do celular para o QR Code do cupom, abra o link e cole o endereço aqui. Ou digite a chave de 44 dígitos impressa no cupom."}
        </Text>
        {canScan && (
          <Pressable
            onPress={() => router.push({ pathname: "/scan-receipt", params: { mode: "code" } })}
            className="mt-3 flex-row items-center justify-center gap-2 rounded-md border border-dashed border-primary py-3"
          >
            <Ionicons name="qr-code-outline" size={18} color={colors.primary} />
            <Text className="text-sm font-medium text-primary dark:text-primary-dark">Ler QR Code do cupom</Text>
          </Pressable>
        )}
        <TextInput
          value={code}
          onChangeText={setCode}
          multiline
          placeholder="https://... ou 0000 0000 0000 ..."
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-3 min-h-20 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground dark:border-border-dark dark:bg-background-dark dark:text-foreground-dark"
        />
        <Text className="mt-3 text-xs text-muted-foreground dark:text-muted-foreground-dark">
          +{rules.pointsPerReceipt} pontos por cupom · hoje {usage.today}/{rules.dailyLimit} · 7 dias {usage.week}/{rules.weeklyLimit}
          {"\n"}Valem compras dos últimos {rules.maxAgeDays} dias.
        </Text>
        <Pressable
          onPress={() => void send()}
          disabled={sending || limitReached || code.trim().length < 20}
          className="mt-4 items-center rounded-md bg-primary py-3 dark:bg-primary-dark"
          style={{ opacity: sending || limitReached || code.trim().length < 20 ? 0.5 : 1 }}
        >
          {sending ? (
            <ActivityIndicator color="#1C1C1E" />
          ) : (
            <Text className="font-semibold text-primary-foreground dark:text-primary-foreground-dark">
              {limitReached ? "Limite atingido por agora" : "Enviar"}
            </Text>
          )}
        </Pressable>
      </Card>

      <Card>
        <View className="flex-row items-baseline justify-between">
          <Text className="text-base font-semibold text-foreground dark:text-foreground-dark">Seus cupons</Text>
          <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
            {totals.receipts} · {totals.points} pontos
          </Text>
        </View>
        {status.history.length === 0 ? (
          <Text className="mt-3 text-sm text-muted-foreground dark:text-muted-foreground-dark">Nenhum cupom enviado ainda.</Text>
        ) : (
          status.history.map((receipt) => (
            <View key={receipt.id} className="mt-3 flex-row items-center justify-between gap-3 border-t border-border pt-3 dark:border-border-dark">
              <View className="flex-1">
                <Text className="text-sm text-foreground dark:text-foreground-dark">
                  {MODEL_LABEL[receipt.model] ?? "Cupom"} de {receipt.uf} · compra de {monthLabel(receipt.issuedMonth)}
                </Text>
                <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                  enviado em {formatDate(receipt.createdAt)}
                </Text>
              </View>
              <Text className="font-mono text-sm text-foreground dark:text-foreground-dark">
                {receipt.status === "approved" ? `+${receipt.points}` : "recusado"}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <Pressable onPress={() => setShowTerms(!showTerms)} className="flex-row items-center justify-between">
          <Text className="font-semibold text-foreground dark:text-foreground-dark">Termo do programa</Text>
          <Ionicons name={showTerms ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
        </Pressable>
        {showTerms && (
          <View className="mt-4">
            <TermsText status={status} />
            {status.consent.acceptedAt && (
              <Text className="mt-4 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                Você aceitou em {formatDate(status.consent.acceptedAt)}.
              </Text>
            )}
            <Pressable onPress={leave} className="mt-4 items-center rounded-md border border-destructive py-2.5 dark:border-destructive-dark">
              <Text className="text-sm font-medium text-destructive dark:text-destructive-dark">Sair do programa</Text>
            </Pressable>
          </View>
        )}
      </Card>
    </>
  );
}
