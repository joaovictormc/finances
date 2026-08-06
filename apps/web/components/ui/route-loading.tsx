import { Spinner } from "@/components/ui/spinner";

/**
 * Fallback exibido pelo Next.js (via loading.tsx) enquanto os Server
 * Components de uma rota do dashboard resolvem os fetches. Sem isso a tela
 * fica em branco durante toda a navegação — lido como "loading infinito".
 */
export function RouteLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Carregando">
      <Spinner size="lg" className="text-muted-foreground" />
    </div>
  );
}
