"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Um client por montagem (e não no escopo do módulo) pra não vazar cache
  // entre requisições caso algum dia isso rode no servidor.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Grupos, categorias, contas e plano mudam pouco: com 1 min de
            // validade, navegar entre telas reaproveita o que já veio em vez
            // de refazer as mesmas chamadas a cada página.
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
