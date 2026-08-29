import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";
import { BASE_PAYMENT_METHOD_TABS, type PaymentMethod } from "@/lib/payment-methods";
import type { Category, FinancialAccount } from "@/lib/types";

type ParsedReceipt = {
  merchant?: string;
  amount?: number;
  date?: string;
  categoryHint?: string;
  confidence: number;
};

type TransactionType = "expense" | "income" | "transfer";

const TYPE_TABS: { value: TransactionType; label: string }[] = [
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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewTransactionScreen() {
  const { colors } = useTheme();
  const [type, setType] = useState<TransactionType>("expense");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("debit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<FinancialAccount[]>("/api/accounts"),
      api.get<Category[]>("/api/categories", { type: type === "transfer" ? "expense" : type }),
    ])
      .then(([accs, cats]) => {
        setAccounts(accs);
        setCategories(cats);
        if (!accountId && accs.length > 0) setAccountId(accs[0].id);
      })
      .finally(() => setLoadingData(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  async function handleSubmit() {
    setError(null);
    const numericAmount = Number(amount.replace(",", "."));
    if (!numericAmount || numericAmount <= 0) {
      setError("Informe um valor válido.");
      return;
    }
    if (!description.trim()) {
      setError("Informe a descrição.");
      return;
    }
    if (!accountId) {
      setError("Selecione uma conta.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/api/transactions", {
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
      setError(err instanceof Error ? err.message : "Erro ao salvar transação.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadReceipt(asset: ImagePicker.ImagePickerAsset) {
    const formData = new FormData();
    formData.append(
      "file",
      { uri: asset.uri, name: asset.fileName ?? "cupom.jpg", type: asset.mimeType ?? "image/jpeg" } as unknown as Blob
    );

    setScanning(true);
    setError(null);
    try {
      const parsed = await api.upload<ParsedReceipt>("/api/transactions/receipt-scan", formData);
      if (parsed.amount) setAmount(String(parsed.amount).replace(".", ","));
      if (parsed.merchant) setDescription(parsed.merchant);
      if (parsed.date) setDate(parsed.date);
      if (parsed.categoryHint) {
        const hint = parsed.categoryHint.toLowerCase();
        const match = flattenCategories(categories).find((c) => c.name.toLowerCase().includes(hint) || hint.includes(c.name.toLowerCase()));
        if (match) setCategoryId(match.id);
      }
      if (parsed.confidence < 0.4) {
        Alert.alert("Confira os dados", "Não consegui ler o cupom com muita confiança — revise os campos antes de salvar.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao ler o cupom.");
    } finally {
      setScanning(false);
    }
  }

  async function handleScanReceipt() {
    Alert.alert("Escanear cupom", "Como você quer enviar a foto?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Tirar foto",
        onPress: async () => {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            setError("Permissão de câmera negada.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.7 });
          if (!result.canceled && result.assets[0]) uploadReceipt(result.assets[0]);
        },
      },
      {
        text: "Escolher da galeria",
        onPress: async () => {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            setError("Permissão de galeria negada.");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.7 });
          if (!result.canceled && result.assets[0]) uploadReceipt(result.assets[0]);
        },
      },
    ]);
  }

  const flatCategories = flattenCategories(categories);
  const selectedAccount = accounts.find((a) => a.id === accountId);

  useEffect(() => {
    if (paymentMethod === "credit" && !selectedAccount?.hasCreditCard) setPaymentMethod("debit");
  }, [selectedAccount, paymentMethod]);

  const paymentMethodTabs = selectedAccount?.hasCreditCard
    ? [...BASE_PAYMENT_METHOD_TABS, { value: "credit" as const, label: "Crédito" }]
    : BASE_PAYMENT_METHOD_TABS;

  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark" contentContainerStyle={{ padding: 16 }}>
      <Pressable
        onPress={handleScanReceipt}
        disabled={scanning}
        className="mb-4 flex-row items-center justify-center gap-2 rounded-md border border-dashed border-primary py-3"
        style={{ opacity: scanning ? 0.6 : 1 }}
      >
        {scanning ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="camera-outline" size={18} color={colors.primary} />
        )}
        <Text className="text-sm font-medium text-primary dark:text-primary-dark">
          {scanning ? "Lendo cupom..." : "Preencher com foto do cupom (Pro)"}
        </Text>
      </Pressable>

      <View className="mb-4 flex-row gap-1.5 rounded-lg bg-muted p-1 dark:bg-muted-dark">
        {TYPE_TABS.map((tab) => (
          <Pressable
            key={tab.value}
            onPress={() => {
              setType(tab.value);
              setCategoryId("");
            }}
            className={`flex-1 items-center rounded-md py-2 ${type === tab.value ? "bg-primary dark:bg-primary-dark" : ""}`}
          >
            <Text
              className={`text-sm font-medium ${type === tab.value ? "text-primary-foreground dark:text-primary-foreground-dark" : "text-muted-foreground dark:text-muted-foreground-dark"}`}
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
        placeholder="Ex: Mercado Extra"
        placeholderTextColor={colors.mutedForeground}
        value={description}
        onChangeText={setDescription}
      />

      {loadingData ? (
        <ActivityIndicator className="mb-4" />
      ) : (
        <>
          <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Conta</Text>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {accounts.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => setAccountId(a.id)}
                className={`rounded-full border px-3 py-1.5 ${accountId === a.id ? "border-primary bg-primary/10 dark:border-primary-dark" : "border-border dark:border-border-dark"}`}
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
                className={`rounded-full border px-3 py-1.5 ${paymentMethod === tab.value ? "border-primary bg-primary/10 dark:border-primary-dark" : "border-border dark:border-border-dark"}`}
              >
                <Text className="text-xs font-medium text-foreground dark:text-foreground-dark">{tab.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Categoria</Text>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {flatCategories.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setCategoryId(c.id)}
                className={`rounded-full border px-3 py-1.5 ${categoryId === c.id ? "border-primary bg-primary/10 dark:border-primary-dark" : "border-border dark:border-border-dark"}`}
              >
                <Text className="text-xs font-medium text-foreground dark:text-foreground-dark">
                  {c.icon ?? ""} {c.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Data (AAAA-MM-DD)</Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        value={date}
        onChangeText={setDate}
      />

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Observações (opcional)</Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        value={notes}
        onChangeText={setNotes}
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
