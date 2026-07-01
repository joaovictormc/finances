import { useEffect, useState } from "react";
import { Alert, View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";
import type { RecurringBill } from "@/lib/types";

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Mensal" },
  { value: "weekly", label: "Semanal" },
  { value: "annual", label: "Anual" },
  { value: "custom", label: "Personalizado" },
];

export default function EditBillScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<RecurringBill[]>("/api/bills")
      .then((bills) => {
        const bill = bills.find((b) => b.id === id);
        if (bill) {
          setName(bill.name);
          setAmount(bill.expectedAmount ? String(Number(bill.expectedAmount)) : "");
          setFrequency(bill.frequency);
          setDayOfMonth(bill.dayOfMonth ? String(bill.dayOfMonth) : "");
          setNextDueDate(bill.nextDueDate ? bill.nextDueDate.slice(0, 10) : "");
        } else {
          setError("Conta recorrente não encontrada.");
        }
      })
      .catch(() => setError("Erro ao carregar."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    setError(null);
    if (!name.trim()) { setError("Informe o nome."); return; }
    const numericAmount = amount ? Number(amount.replace(",", ".")) : undefined;
    if (numericAmount !== undefined && (Number.isNaN(numericAmount) || numericAmount <= 0)) {
      setError("Valor inválido."); return;
    }
    setSaving(true);
    try {
      await api.patch(`/api/bills/${id}`, {
        name: name.trim(),
        expectedAmount: numericAmount,
        frequency,
        dayOfMonth: frequency === "monthly" && dayOfMonth ? parseInt(dayOfMonth, 10) : undefined,
        nextDueDate: nextDueDate || undefined,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert("Excluir conta recorrente", "Esta ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await api.delete(`/api/bills/${id}`);
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
        placeholder="Ex: Netflix, Aluguel"
        placeholderTextColor={colors.mutedForeground}
        value={name}
        onChangeText={setName}
      />

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Valor esperado (opcional)</Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="0,00"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Frequência</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {FREQUENCY_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => setFrequency(opt.value)}
            className={`rounded-full border px-3 py-1.5 ${frequency === opt.value ? "border-primary bg-primary/10" : "border-border dark:border-border-dark"}`}
          >
            <Text className="text-xs font-medium text-foreground dark:text-foreground-dark">{opt.label}</Text>
          </Pressable>
        ))}
      </View>

      {frequency === "monthly" && (
        <>
          <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Dia do mês</Text>
          <TextInput
            className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
            placeholder="Ex: 10"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            value={dayOfMonth}
            onChangeText={setDayOfMonth}
          />
        </>
      )}

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">
        Próximo vencimento (AAAA-MM-DD, opcional)
      </Text>
      <TextInput
        className="mb-6 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="2026-07-10"
        placeholderTextColor={colors.mutedForeground}
        value={nextDueDate}
        onChangeText={setNextDueDate}
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
          <Text className="font-medium text-destructive dark:text-destructive-dark">Excluir conta recorrente</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
