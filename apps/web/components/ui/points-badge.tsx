"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useGamificationProfile } from "@/lib/queries";

/** Badge compacto com o total de pontos de gamificação — sempre visível na navegação, leva pra /rewards. */
export function PointsBadge() {
  // Mesma chave do card de Progresso: um giro de roleta lá atualiza o badge aqui.
  const { data } = useGamificationProfile();

  if (!data) return null;

  return (
    <Link
      href="/rewards"
      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
      title="Meus pontos e recompensas"
    >
      <Sparkles size={12} />
      {data.points}
    </Link>
  );
}
