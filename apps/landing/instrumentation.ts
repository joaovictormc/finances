/**
 * Roda uma vez quando o servidor sobe. O build (Docker, CI) não alcança a API,
 * então as páginas saem com o conteúdo de fábrica e ficariam assim até a
 * revalidação de uma hora. Aqui o servidor pede a própria revalidação logo
 * após subir: o primeiro visitante já recebe o conteúdo publicado no admin.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const secret = process.env.LANDING_REVALIDATE_SECRET;
  if (!secret) return;

  const port = process.env.PORT ?? "3002";
  const timer = setTimeout(() => {
    fetch(`http://127.0.0.1:${port}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify({ all: true }),
    }).catch(() => {
      // Sem resposta: a revalidação de uma hora cobre.
    });
  }, 3000);
  timer.unref();
}
