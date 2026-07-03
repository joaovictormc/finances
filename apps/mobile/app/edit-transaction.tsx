import { useEffect, useState } from "react";
import { Alert, View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";
import { BASE_PAYMENT_METHOD_TABS, type PaymentMethod } from "@/lib/payment-methods";
import type { Category, FinancialAccount, Transaction } from "@/lib/types";

type TxType = "expense" | "income" | "transfer";

const TYPE_TABS: { value: TxType; label: string }[] = [
  { value: "expense", label: "Gasto" },
  { value: "income", label: "Receita" },
  { value: "transfer", label: "Transferência" },
];

function flattenCategories(cats: Category[]): Category[] {
  const result: Category[] = [];
  for (const c of cats) {
    result.push(c);
    if (c.children?.length) result.push(...flattenCategories(c.children));
  }
  return result;
}

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<TxType>("expense");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("debit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Transaction>(`/api/transactions/${id}`),
      api.get<FinancialAccount[]>("/api/accounts"),
    ])
      .then(([tx, accs]) => {
        setType(tx.type);
        setPaymentMethod(tx.paymentMethod ?? "debit");
        setAmount(String(Number(tx.amount)));
        setDescription(tx.description);
        setDate(tx.date.slice(0, 10));
        setNotes(tx.notes ?? "");
        setAccountId(tx.account.id);
        setCategoryId(tx.category?.id ?? "");
        setAccounts(accs);
      })
      .catch(() => setError("Erro ao carregar transação."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (loading) return;
    api
      .get<Category[]>("/api/categories", { type: type === "transfer" ? "expense" : type })
      .then(setCategories)
      .catch(() => {});
  }, [type, loading]);

  const selectedAccount = accounts.find((a) => a.id === accountId);

  useEffect(() => {
    if (paymentMethod === "credit" && !selectedAccount?.hasCreditCard) setPaymentMethod("debit");
  }, [selectedAccount, paymentMethod]);

  async function handleSave() {
    setError(null);
    const numericAmount = Number(amount.replace(",", "."));
    if (!numericAmount || numericAmount <= 0) { setError("Valor inválido."); return; }
    if (!description.trim()) { setError("Informe a descrição."); return; }
    if (!accountId) { setError("Selecione uma conta."); return; }
    setSaving(true);
    try {
      await api.patch(`/api/transactions/${id}`, {
        type,
        paymentMethod,
        amount: numericAmount,
        description: description.trim(),
        accountId,
        categoryId: categoryId || undefined,
        date,
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert("Excluir transação", "Esta ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await api.delete(`/api/transactions/${id}`);
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

  const flatCategories = flattenCategories(categories);

  const paymentMethodTabs = selectedAccount?.hasCreditCard
    ? [...BASE_PAYMENT_METHOD_TABS, { value: "credit" as const, label: "Crédito" }]
    : BASE_PAYMENT_METHOD_TABS;

  return (
    <ScrollView
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerStyle={{ padding: 16 }}
    >
      <View className="mb-4 flex-row gap-1.5 rounded-lg bg-muted p-1 dark:bg-muted-dark">
        {TYPE_TABS.map((tab) => (
          <Pressable
            key={tab.value}
            onPress={() => { setType(tab.value); setCategoryId(""); }}
            className={`flex-1 items-center rounded-md py-2 ${type === tab.value ? "bg-primary" : ""}`}
          >
            <Text
              className={`text-sm font-medium ${type === tab.value ? "text-primary-foreground" : "text-muted-foreground dark:text-muted-foreground-dark"}`}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Valor</Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="0,00"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Descrição</Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        value={description}
        onChangeText={setDescription}
      />

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Conta</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {accounts.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => setAccountId(a.id)}
            className={`rounded-full border px-3 py-1.5 ${accountId === a.id ? "border-primary bg-primary/10" : "border-border dark:border-border-dark"}`}
          >
            <Text className="text-xs font-medium text-foreground dark:text-foreground-dark">{a.name}</Text>
          </Pressable>
        ))}
      </View>

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Forma de pagamento</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {paymentMethodTabs.map((tab) => (
          <Pressable
            key={tab.value}
            onPress={() => setPaymentMethod(tab.value)}
            className={`rounded-full border px-3 py-1.5 ${paymentMethod === tab.value ? "border-primary bg-primary/10" : "border-border dark:border-border-dark"}`}
          >
            <Text className="text-xs font-medium text-foreground dark:text-foreground-dark">{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Categoria</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        <Pressable
          onPress={() => setCategoryId("")}
          className={`rounded-full border px-3 py-1.5 ${!categoryId ? "border-primary bg-primary/10" : "border-border dark:border-border-dark"}`}
        >
          <Text className="text-xs font-medium text-foreground dark:text-foreground-dark">Sem categoria</Text>
        </Pressable>
        {flatCategories.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setCategoryId(c.id)}
            className={`rounded-full border px-3 py-1.5 ${categoryId === c.id ? "border-primary bg-primary/10" : "border-border dark:border-border-dark"}`}
          >
            <Text className="text-xs font-medium text-foreground dark:text-foreground-dark">
              {c.icon ?? ""} {c.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Data (AAAA-MM-DD)</Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        value={date}
        onChangeText={setDate}
      />

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Observações (opcional)</Text>
      <TextInput
        className="mb-6 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        value={notes}
        onChangeText={setNotes}
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
          <Text className="font-medium text-destructive dark:text-destructive-dark">Excluir transação</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
