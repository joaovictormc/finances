"use client";

import { useState } from "react";
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

export function ImportForm({ accounts, onSuccess, fixedAccountId }: ImportFormProps) {
  const { toast } = useToast();
  const [accountId, setAccountId] = useState(fixedAccountId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fixedAccount = fixedAccountId ? accounts.find((a) => a.id === fixedAccountId) : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !file) {
      toast({ title: "Selecione a conta e o arquivo", variant: "error" });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("accountId", accountId);
      formData.append("file", file);

      const result = await api.upload<{ imported: number; totalInFile: number }>(
        "/api/transactions/import",
        formData
      );

      toast({
        title: `${result.imported} transações importadas`,
        description:
          result.imported < result.totalInFile
            ? `${result.totalInFile - result.imported} já existiam e foram ignoradas`
            : undefined,
        variant: "success",
      });
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

      <div className="flex flex-col gap-1">
        <label htmlFor="import-file" className="text-sm font-medium text-foreground">
          Arquivo (.csv ou .ofx)
        </label>
        <input
          id="import-file"
          type="file"
          accept=".csv,.ofx,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
        />
      </div>

      <Button type="submit" loading={isSubmitting} className="mt-2">
        Importar
      </Button>
    </form>
  );
}
