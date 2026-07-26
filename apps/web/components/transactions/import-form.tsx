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

type ImportBatchResult = {
  imported: number;
  filesProcessed: number;
  results: Array<{
    fileName: string;
    status: "success" | "error";
    imported: number;
    duplicates: number;
    error?: string;
  }>;
};

async function importFiles(
  accountId: string,
  files: Array<{ paymentMethod: "debit" | "credit"; file: File }>
) {
  const formData = new FormData();
  formData.append("accountId", accountId);
  for (const { paymentMethod, file } of files) {
    formData.append("files", file);
    formData.append("paymentMethods", paymentMethod);
  }
  return api.upload<ImportBatchResult>("/api/transactions/import/batch", formData);
}

export function ImportForm({ accounts, onSuccess, fixedAccountId }: ImportFormProps) {
  const { toast } = useToast();
  const [accountId, setAccountId] = useState(fixedAccountId ?? "");
  const [debitFiles, setDebitFiles] = useState<File[]>([]);
  const [creditFiles, setCreditFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fixedAccount = fixedAccountId ? accounts.find((account) => account.id === fixedAccountId) : undefined;
  const effectiveAccountId = fixedAccountId ?? accountId;
  const effectiveAccount = accounts.find((account) => account.id === effectiveAccountId);
  const showCreditSlot = effectiveAccount?.hasCreditCard;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const files: Array<{ paymentMethod: "debit" | "credit"; file: File }> = [
      ...debitFiles.map((file) => ({ paymentMethod: "debit" as const, file })),
      ...(showCreditSlot
        ? creditFiles.map((file) => ({ paymentMethod: "credit" as const, file }))
        : []),
    ];

    if (!effectiveAccountId || files.length === 0) {
      toast({ title: "Selecione a conta e ao menos um arquivo", variant: "error" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await importFiles(effectiveAccountId, files);
      const failed = result.results.filter((fileResult) => fileResult.status === "error");
      const duplicates = result.results.reduce((sum, fileResult) => sum + fileResult.duplicates, 0);

      toast({
        title: `${result.imported} transações importadas de ${result.filesProcessed} arquivos`,
        description:
          failed.length > 0
            ? `${failed.length} arquivo(s) falharam: ${failed.map((item) => item.fileName).join(", ")}`
            : duplicates > 0
              ? `${duplicates} transações duplicadas foram ignoradas`
              : undefined,
        variant: failed.length > 0 ? "warning" : "success",
      });
      setDebitFiles([]);
      setCreditFiles([]);
      onSuccess();
    } catch (error) {
      toast({
        title: "Erro ao importar arquivos",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Envie até 20 extratos CSV ou OFX de uma vez. Cada arquivo pode ter até 10 MB e o lote,
        até 50 MB. Transações já importadas são ignoradas automaticamente.
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
          onChange={(event) => {
            setAccountId(event.target.value);
            setCreditFiles([]);
          }}
          options={accounts.map((account) => ({ value: account.id, label: account.name }))}
        />
      )}

      <FileSlot
        label={showCreditSlot ? "Extratos da conta corrente" : "Extratos (.csv ou .ofx)"}
        files={debitFiles}
        onChange={setDebitFiles}
      />

      {showCreditSlot && (
        <FileSlot
          label="Faturas de cartão de crédito"
          files={creditFiles}
          onChange={setCreditFiles}
        />
      )}

      <Button type="submit" loading={isSubmitting} className="mt-2">
        Importar lote
      </Button>
    </form>
  );
}

function FileSlot({
  label,
  files,
  onChange,
}: {
  label: string;
  files: File[];
  onChange: (files: File[]) => void;
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
        multiple
        accept=".csv,.ofx,text/csv"
        onChange={(event) => onChange(Array.from(event.target.files ?? []))}
        className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
      />
      {files.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`}>{file.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
