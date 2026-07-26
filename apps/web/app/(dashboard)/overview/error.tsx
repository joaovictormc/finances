"use client";

import { Button } from "@/components/ui/button";

export default function OverviewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="mx-auto mt-16 max-w-xl rounded-2xl border border-destructive/30 bg-card p-8 text-center shadow-sm"
    >
      <h1 className="text-xl font-semibold text-foreground">Não foi possível carregar a visão geral</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Seus dados não foram interpretados como saldo zero. Verifique a conexão e tente novamente.
      </p>
      {error.digest && (
        <p className="mt-3 text-xs text-muted-foreground">Referência do erro: {error.digest}</p>
      )}
      <Button type="button" onClick={reset} className="mt-6">
        Tentar novamente
      </Button>
    </div>
  );
}
