import { useEffect, useState } from "react";
import { Alert, View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Switch } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";
import { StatementImport } from "@/components/statement-import";
import type { FinancialAccount } from "@/lib/types";

const TYPE_OPTIONS = [
  { value: "checking", label: "Conta Corrente" },
  { value: "savings", label: "Poupança" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "investment", label: "Investimento" },
  { value: "wallet", label: "Carteira" },
];

export default function EditAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState("checking");
  const [institution, setInstitution] = useState("");
  const [hasCreditCard, setHasCreditCard] = useState(false);
  const [account, setAccount] = useState<FinancialAccount | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<FinancialAccount[]>("/api/accounts")
      .then((accounts) => {
        const acc = accounts.find((a) => a.id === id);
        if (acc) {
          setName(acc.name);
          setType(acc.type);
          setInstitution(acc.institution ?? "");
          setHasCreditCard(acc.hasCreditCard ?? false);
          setAccount(acc);
        } else {
          setError("Conta não encontrada.");
        }
      })
      .catch(() => setError("Erro ao carregar conta."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    setError(null);
    if (!name.trim()) { setError("Informe o nome da conta."); return; }
    setSaving(true);
    try {
      const updated = await api.patch<FinancialAccount>(`/api/accounts/${id}`, {
        name: name.trim(),
        type,
        institution: institution.trim() || undefined,
        hasCreditCard,
      });
      setAccount(updated);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert("Excluir conta", "Todas as transações vinculadas serão afetadas. Continuar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await api.delete(`/api/accounts/${id}`);
            router.back();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao excluir.");
            setDeleting(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerStyle={{ padding: 16 }}
    >
      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Nome</Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="Ex: Nubank, Itaú Corrente"
        placeholderTextColor={colors.mutedForeground}
        value={name}
        onChangeText={setName}
      />

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Tipo</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {TYPE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => setType(opt.value)}
            className={`rounded-full border px-3 py-1.5 ${type === opt.value ? "border-primary bg-primary/10" : "border-border dark:border-border-dark"}`}
          >
            <Text className="text-xs font-medium text-foreground dark:text-foreground-dark">{opt.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Instituição (opcional)</Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="Ex: Nubank, Itaú, Bradesco"
        placeholderTextColor={colors.mutedForeground}
        value={institution}
        onChangeText={setInstitution}
      />

      <View className="mb-6 flex-row items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 dark:border-border-dark dark:bg-card-dark">
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">
            Tem cartão de crédito vinculado
          </Text>
          <Text className="mt-0.5 text-xs text-muted-foreground dark:text-muted-foreground-dark">
            Permite escolher débito ou crédito ao lançar transações nessa conta.
          </Text>
        </View>
        <Switch
          value={hasCreditCard}
          onValueChange={setHasCreditCard}
          trackColor={{ true: colors.primary }}
        />
      </View>

      <Pressable
        onPress={() => setShowImport((v) => !v)}
        className="mb-6 flex-row items-center justify-between rounded-xl border border-border bg-card p-4 dark:border-border-dark dark:bg-card-dark"
      >
        <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">
          📄 Importar extrato (CSV/OFX)
        </Text>
        <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
          {showImport ? "Fechar" : "Abrir"}
        </Text>
      </Pressable>

      {showImport && account && (
        <View className="mb-6">
          <StatementImport account={account} />
        </View>
      )}

      {error && <Text className="mb-3 text-sm text-destructive dark:text-destructive-dark">{error}</Text>}

      <Pressable
        onPress={handleSave}
        disabled={saving || deleting}
        className="mb-3 items-center rounded-md bg-primary py-3"
      >
        {saving ? (
          <ActivityIndicator color="#1C1C1E" />
        ) : (
          <Text className="font-semibold text-primary-foreground">Salvar alterações</Text>
        )}
      </Pressable>

      <Pressable
        onPress={confirmDelete}
        disabled={saving || deleting}
        className="items-center rounded-md border border-destructive py-3"
      >
        {deleting ? (
          <ActivityIndicator color="#ef4444" />
        ) : (
          <Text className="font-medium text-destructive dark:text-destructive-dark">Excluir conta</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
