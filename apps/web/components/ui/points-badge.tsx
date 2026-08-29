"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { api } from "@/lib/api-client";

/** Badge compacto com o total de pontos de gamificação — sempre visível na navegação, leva pra /rewards. */
export function PointsBadge() {
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<{ points: number }>("/api/gamification/profile")
      .then((p) => setPoints(p.points))
      .catch(() => setPoints(null));
  }, []);

  if (points === null) return null;

  return (
    <Link
      href="/rewards"
      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
      title="Meus pontos e recompensas"
    >
      <Sparkles size={12} />
      {points}
    </Link>
  );
}
