"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";
import type { FinancialAccount } from "@/lib/types";

interface ImportFormProps {
  accounts: FinancialAccount[];
  onSuccess: () => void;
  fixedAccountId?: string;
}

async function importFile(accountId: string, paymentMethod: "debit" | "credit", file: File) {
  const formData = new FormData();
  formData.append("accountId", accountId);
  formData.append("paymentMethod", paymentMethod);
  formData.append("file", file);
  return api.upload<{ imported: number; totalInFile: number }>("/api/transactions/import", formData);
}

export function ImportForm({ accounts, onSuccess, fixedAccountId }: ImportFormProps) {
  const { toast } = useToast();
  const [accountId, setAccountId] = useState(fixedAccountId ?? "");
  const [debitFile, setDebitFile] = useState<File | null>(null);
  const [creditFile, setCreditFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fixedAccount = fixedAccountId ? accounts.find((a) => a.id === fixedAccountId) : undefined;
  const effectiveAccountId = fixedAccountId ?? accountId;
  const showCreditSlot = fixedAccount?.hasCreditCard;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const files: { paymentMethod: "debit" | "credit"; file: File }[] = [];
    if (debitFile) files.push({ paymentMethod: "debit", file: debitFile });
    if (showCreditSlot && creditFile) files.push({ paymentMethod: "credit", file: creditFile });

    if (!effectiveAccountId || files.length === 0) {
      toast({ title: "Selecione a conta e ao menos um arquivo", variant: "error" });
      return;
    }

    setIsSubmitting(true);
    try {
      const results = await Promise.all(
        files.map(({ paymentMethod, file }) => importFile(effectiveAccountId, paymentMethod, file))
      );
      const imported = results.reduce((sum, r) => sum + r.imported, 0);
      const totalInFile = results.reduce((sum, r) => sum + r.totalInFile, 0);

      toast({
        title: `${imported} transações importadas`,
        description: imported < totalInFile ? `${totalInFile - imported} já existiam e foram ignoradas` : undefined,
        variant: "success",
      });
      setDebitFile(null);
      setCreditFile(null);
      onSuccess();
    } catch (err) {
      toast({
        title: "Erro ao importar arquivo",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Envie um extrato em CSV (colunas Data, Descrição, Valor) ou OFX exportado do seu banco.
        Transações já importadas anteriormente são ignoradas automaticamente.
      </p>

      {fixedAccount ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Conta de destino:</span>{" "}
          <span className="font-medium text-foreground">{fixedAccount.name}</span>
        </p>
      ) : (
        <Select
          label="Conta de destino"
          placeholder="Selecione a conta"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
        />
      )}

      <FileSlot
        label={showCreditSlot ? "Extrato conta corrente" : "Arquivo (.csv ou .ofx)"}
        file={debitFile}
        onChange={setDebitFile}
      />

      {showCreditSlot && (
        <FileSlot label="Fatura cartão de crédito" file={creditFile} onChange={setCreditFile} />
      )}

      <Button type="submit" loading={isSubmitting} className="mt-2">
        Importar
      </Button>
    </form>
  );
}

function FileSlot({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const inputId = useId();

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={inputId}
        type="file"
        accept=".csv,.ofx,text/csv"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
      />
      {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
    </div>
  );
}
