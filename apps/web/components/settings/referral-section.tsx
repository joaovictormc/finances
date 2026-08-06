"use client";

import { useEffect, useState } from "react";
import { Copy, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";

interface ReferralSummary {
  total: number;
  rewardsGranted: number;
  referrals: Array<{ id: string; referredName: string; rewardGranted: boolean; createdAt: string }>;
}

export function ReferralSection() {
  const { toast } = useToast();
  const [link, setLink] = useState("");
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ code: string; link: string }>("/api/referrals/code"),
      api.get<ReferralSummary>("/api/referrals"),
    ])
      .then(([codeRes, summaryRes]) => {
        setLink(codeRes.link);
        setSummary(summaryRes);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    toast({ title: "Link copiado!", variant: "success" });
  };

  return (
    <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-1">
        <Gift size={16} className="text-muted-foreground" />
        <h2 className="text-base font-semibold">Indique e ganhe</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Compartilhe seu link. Quando a pessoa indicada assinar um plano pago, você ganha 30 dias grátis.
      </p>

      {!isLoading && link && (
        <div className="flex items-center gap-2 mb-4">
          <input
            readOnly
            value={link}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <Button onClick={handleCopy} size="sm" variant="outline">
            <Copy size={14} />
            Copiar
          </Button>
        </div>
      )}

      {summary && summary.total > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {summary.total} indicação{summary.total > 1 ? "ões" : ""} · {summary.rewardsGranted} recompensa
            {summary.rewardsGranted !== 1 ? "s" : ""} concedida{summary.rewardsGranted !== 1 ? "s" : ""}
          </p>
          <ul className="space-y-1">
            {summary.referrals.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <span>{r.referredName}</span>
                <span className={r.rewardGranted ? "text-success" : "text-muted-foreground"}>
                  {r.rewardGranted ? "Recompensa concedida" : "Aguardando assinatura"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
