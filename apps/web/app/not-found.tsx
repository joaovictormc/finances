import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="font-mono text-4xl font-medium tabular-nums text-muted-foreground">404</p>
        <h1 className="mt-3 text-xl font-semibold text-foreground">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço que você abriu não existe ou foi movido.
        </p>
        <Link
          href="/overview"
          className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
        >
          Voltar para a visão geral
        </Link>
      </div>
    </main>
  );
}
