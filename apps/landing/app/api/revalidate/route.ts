import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "node:crypto";

/**
 * Chamado pela API quando o admin publica: regera as páginas pedidas na hora.
 * Protegido por segredo compartilhado (LANDING_REVALIDATE_SECRET nos dois lados).
 */
export async function POST(request: Request) {
  const secret = process.env.LANDING_REVALIDATE_SECRET;
  const given = request.headers.get("x-revalidate-secret") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { paths?: unknown; all?: unknown } | null;
  // Todas as páginas de uma vez (servidor recém-iniciado, ver instrumentation.ts).
  if (body?.all === true) {
    revalidatePath("/", "layout");
    return Response.json({ revalidated: "all" });
  }
  const paths = Array.isArray(body?.paths) ? body.paths.filter((p): p is string => typeof p === "string" && p.startsWith("/")) : [];
  for (const path of paths) revalidatePath(path);
  return Response.json({ revalidated: paths });
}
