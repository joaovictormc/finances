import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";
import type { FinancialAccount } from "@/lib/types";

async function pickDocument(): Promise<DocumentPicker.DocumentPickerAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0];
}

async function importStatement(
  accountId: string,
  paymentMethod: "debit" | "credit",
  asset: DocumentPicker.DocumentPickerAsset
) {
  const formData = new FormData();
  formData.append("accountId", accountId);
  formData.append("paymentMethod", paymentMethod);
  if (Platform.OS === "web" && asset.file) {
    formData.append("file", asset.file);
  } else {
    // O fetch mais novo do Expo (WinterCG-compliant) não entende mais o
    // objeto {uri, name, type} que o React Native tradicionalmente aceitava
    // pra representar um arquivo local — precisa de um Blob de verdade.
    const blob = await (await fetch(asset.uri)).blob();
    formData.append("file", blob, asset.name);
  }
  return api.upload<{ imported: number; totalInFile: number }>("/api/transactions/import", formData);
}

function FileSlot({
  label,
  asset,
  onPick,
}: {
  label: string;
  asset: DocumentPicker.DocumentPickerAsset | null;
  onPick: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View className="mb-4">
      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">{label}</Text>
      <Pressable
        onPress={onPick}
        className="flex-row items-center justify-between rounded-md border border-border bg-card px-3 py-3 dark:border-border-dark dark:bg-card-dark"
      >
        <Text className="flex-1 text-sm text-foreground dark:text-foreground-dark" numberOfLines={1}>
          {asset?.name ?? "Selecionar arquivo (.csv ou .ofx)"}
        </Text>
        <Text className="ml-2 text-xs font-medium" style={{ color: colors.primary }}>
          {asset ? "Trocar" : "Escolher"}
        </Text>
      </Pressable>
    </View>
  );
}

export function StatementImport({
  account,
  onImported,
}: {
  account: FinancialAccount;
  onImported?: () => void;
}) {
  const [debitFile, setDebitFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [creditFile, setCreditFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);

  async function handleImport() {
    setImportError(null);
    setImportResult(null);
    const files: { paymentMethod: "debit" | "credit"; asset: DocumentPicker.DocumentPickerAsset }[] = [];
    if (debitFile) files.push({ paymentMethod: "debit", asset: debitFile });
    if (account.hasCreditCard && creditFile) files.push({ paymentMethod: "credit", asset: creditFile });

    if (files.length === 0) {
      setImportError("Selecione ao menos um arquivo.");
      return;
    }

    setImporting(true);
    try {
      const results = await Promise.all(
        files.map(({ paymentMethod, asset }) => importStatement(account.id, paymentMethod, asset))
      );
      const imported = results.reduce((sum, r) => sum + r.imported, 0);
      const totalInFile = results.reduce((sum, r) => sum + r.totalInFile, 0);
      setImportResult(
        `${imported} transações importadas${imported < totalInFile ? ` · ${totalInFile - imported} já existiam` : ""}`
      );
      setDebitFile(null);
      setCreditFile(null);
      onImported?.();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Erro ao importar arquivo.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <View>
      <Text className="mb-4 text-sm text-muted-foreground dark:text-muted-foreground-dark">
        Envie um extrato em CSV (colunas Data, Descrição, Valor) ou OFX exportado do seu banco. Transações
        repetidas são ignoradas automaticamente.
      </Text>

      <FileSlot
        label={account.hasCreditCard ? "Extrato conta corrente" : "Arquivo (.csv ou .ofx)"}
        asset={debitFile}
        onPick={async () => setDebitFile(await pickDocument())}
      />

      {account.hasCreditCard && (
        <FileSlot label="Fatura cartão de crédito" asset={creditFile} onPick={async () => setCreditFile(await pickDocument())} />
      )}

      {importError && <Text className="mb-3 text-sm text-destructive dark:text-destructive-dark">{importError}</Text>}
      {importResult && <Text className="mb-3 text-sm text-foreground dark:text-foreground-dark">{importResult}</Text>}

      <Pressable
        onPress={handleImport}
        disabled={importing}
        className="items-center rounded-md bg-primary py-3 dark:bg-primary-dark"
      >
        {importing ? (
          <ActivityIndicator color="#1C1C1E" />
        ) : (
          <Text className="font-medium text-primary-foreground dark:text-primary-foreground-dark">Importar</Text>
        )}
      </Pressable>
    </View>
  );
}
