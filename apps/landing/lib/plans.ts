import { API_URL, SERVER_API_URL } from "./links";

export type Interval = "monthly" | "semiannual" | "annual";

export type PlanPrice = {
  interval: Interval;
  label: string;
  months: number;
  priceCents: number;
  monthlyEquivalentCents: number;
};

/** Formato de GET /api/public/plans — features do código, preços do banco. */
export type Plan = {
  id: "free" | "pro" | "familia";
  name: string;
  priceCents: number;
  prices: PlanPrice[];
  historyMonths: number | null;
  aiInsights: boolean;
  receiptScan: boolean;
  assistant: boolean;
  maxGroupMembers: number;
};

export const PLANS_ENDPOINT = `${API_URL}/api/public/plans`;

/**
 * Preços no servidor (revalidados a cada 5 min). Falhou, devolve null e a
 * tabela espera o navegador conseguir buscar.
 */
export async function fetchPlans(): Promise<Plan[] | null> {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/public/plans`, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as Plan[];
  } catch {
    return null;
  }
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCents(cents: number): string {
  return brl.format(cents / 100);
}
