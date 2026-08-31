"use client";

import { Button } from "@/components/ui/button";

// Boundary do dashboard inteiro. Telas com diagnóstico próprio (como
// overview/error.tsx) continuam tendo prioridade por serem mais específicas.
export default function DashboardError({
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
      <h1 className="text-xl font-semibold text-foreground">Algo deu errado nesta tela</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A página não pôde ser carregada. Seus dados não foram alterados.
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
