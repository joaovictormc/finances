"use client";

import { useAdminPending, type AdminPending } from "@/lib/queries";

const LABELS: Record<Exclude<keyof AdminPending, "total">, (n: number) => string> = {
  changelogDrafts: (n) => (n === 1 ? "1 rascunho para revisar" : `${n} rascunhos para revisar`),
  pixCheckouts: (n) => (n === 1 ? "1 Pix aguardando confirmação" : `${n} Pix aguardando confirmação`),
};

/** Selo de pendência no cartão de uma área do painel admin. */
export function AdminPendingBadge({ kind }: { kind: Exclude<keyof AdminPending, "total"> }) {
  const count = useAdminPending(true).data?.[kind] ?? 0;
  if (count === 0) return null;
  return (
    <span className="mt-2 inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
      {LABELS[kind](count)}
    </span>
  );
}
