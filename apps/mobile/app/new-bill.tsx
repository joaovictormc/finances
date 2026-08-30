import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { api } from "@/lib/api-client";
import { DateField } from "@/components/date-field";
import { useTheme } from "@/lib/theme";

const FREQUENCY_OPTIONS: { value: string; label: string }[] = [
  { value: "monthly", label: "Mensal" },
  { value: "weekly", label: "Semanal" },
  { value: "annual", label: "Anual" },
  { value: "custom", label: "Personalizado" },
];

export default function NewBillScreen() {
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError("Informe o nome da conta.");
      return;
    }

    const numericAmount = amount ? Number(amount.replace(",", ".")) : undefined;
    if (numericAmount !== undefined && (Number.isNaN(numericAmount) || numericAmount <= 0)) {
      setError("Valor esperado inválido.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/api/bills", {
        name: name.trim(),
        expectedAmount: numericAmount,
        frequency,
        dayOfMonth: frequency === "monthly" && dayOfMonth ? parseInt(dayOfMonth, 10) : undefined,
        nextDueDate: nextDueDate || undefined,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar conta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark" contentContainerStyle={{ padding: 16 }}>
      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Nome</Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="Ex: Netflix, Aluguel, Internet"
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
            className={`rounded-full border px-3 py-1.5 ${frequency === opt.value ? "border-primary bg-primary/10 dark:border-primary-dark" : "border-border dark:border-border-dark"}`}
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

      <DateField
        label="Próximo vencimento (opcional)"
        value={nextDueDate}
        onChange={setNextDueDate}
      />

      {error && <Text className="mb-3 text-sm text-destructive dark:text-destructive-dark">{error}</Text>}

      <Pressable
        onPress={handleSubmit}
        disabled={saving}
        className="items-center rounded-md bg-primary py-3 dark:bg-primary-dark"
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-medium text-primary-foreground dark:text-primary-foreground-dark">Salvar</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
