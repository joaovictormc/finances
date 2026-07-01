import { useEffect, useState } from "react";
import { Alert, View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";
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
      await api.patch(`/api/accounts/${id}`, {
        name: name.trim(),
        type,
        institution: institution.trim() || undefined,
      });
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
        className="mb-6 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="Ex: Nubank, Itaú, Bradesco"
        placeholderTextColor={colors.mutedForeground}
        value={institution}
        onChangeText={setInstitution}
      />

      {error && <Text className="mb-3 text-sm text-destructive dark:text-destructive-dark">{error}</Text>}

      <Pressable
        onPress={handleSave}
        disabled={saving || deleting}
        className="mb-3 items-center rounded-md bg-primary py-3"
      >
        {saving ? (
          <ActivityIndicator color="#14142B" />
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
