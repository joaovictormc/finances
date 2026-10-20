"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ReceiptText } from "lucide-react";
import type { ReceiptRewardStatus } from "@finances/validations";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-provider";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

const QUERY_KEY = ["receipt-rewards"];
const MODEL_LABEL: Record<string, string> = { "65": "NFC-e", "59": "SAT" };

function monthLabel(issuedMonth: string) {
  const [year, month] = issuedMonth.split("-");
  return `${month}/${year}`;
}

export default function ReceiptRewardsPage() {
  const queryClient = useQueryClient();
  const { data: status, isPending, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.get<ReceiptRewardStatus>("/api/receipt-rewards"),
  });
  const update = (next: ReceiptRewardStatus) => {
    queryClient.setQueryData(QUERY_KEY, next);
    void queryClient.invalidateQueries({ queryKey: ["gamification-profile"] });
  };

  return (
    <div className="max-w-2xl">
      <BackButton href="/rewards" label="Recompensas" />
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ReceiptText size={22} /> Recompensa por cupom
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Envie cupons fiscais das suas compras e ganhe pontos.</p>
      </div>

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="text-sm text-muted-foreground">Não foi possível carregar o programa agora.</p>
      ) : !status.enabled ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          O programa de recompensa por cupom ainda não está ativo. Avisaremos quando abrir.
        </p>
      ) : status.consent.active ? (
        <Participating status={status} onChange={update} />
      ) : (
        <Terms status={status} onChange={update} />
      )}
    </div>
  );
}

function TermsText({ status }: { status: ReceiptRewardStatus }) {
  return (
    <div className="space-y-4 text-sm">
      {status.terms.sections.map((section) => (
        <div key={section.heading}>
          <h3 className="font-semibold text-foreground">{section.heading}</h3>
          {section.body.map((paragraph, index) => (
            <p key={index} className="mt-1 text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </div>
      ))}
      <p className="font-mono text-xs text-muted-foreground">Versão do termo: {status.terms.version}</p>
    </div>
  );
}

function Terms({ status, onChange }: { status: ReceiptRewardStatus; onChange: (s: ReceiptRewardStatus) => void }) {
  const { toast } = useToast();
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  async function accept() {
    setSaving(true);
    try {
      onChange(await api.post<ReceiptRewardStatus>("/api/receipt-rewards/consent", { version: status.terms.version }));
      toast({ title: "Pronto! Você já pode enviar cupons.", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Não foi possível registrar o aceite", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
      {status.consent.outdated && (
        <p className="mb-4 rounded-lg bg-primary/15 px-3 py-2 text-sm text-foreground">
          O termo do programa mudou. Leia a versão nova e aceite para continuar enviando cupons.
        </p>
      )}
      <h2 className="mb-3 text-base font-semibold">Termo do programa</h2>
      <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-border/60 p-4">
        <TermsText status={status} />
      </div>
      <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-foreground">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
        />
        Li e aceito o termo do programa de recompensa por cupom.
      </label>
      <div className="mt-4 flex justify-end">
        <Button type="button" onClick={() => void accept()} disabled={!agreed} loading={saving}>
          Participar
        </Button>
      </div>
    </section>
  );
}

function Participating({ status, onChange }: { status: ReceiptRewardStatus; onChange: (s: ReceiptRewardStatus) => void }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const { rules, usage, totals } = status;
  const limitReached = usage.today >= rules.dailyLimit || usage.week >= rules.weeklyLimit;

  async function send() {
    setSending(true);
    try {
      const result = await api.post<{ points: number; uf: string; status: ReceiptRewardStatus }>("/api/receipt-rewards/receipts", {
        code,
      });
      onChange(result.status);
      setCode("");
      toast({ title: `Cupom de ${result.uf} aceito: +${result.points} pontos`, variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Não foi possível enviar o cupom", variant: "error" });
    } finally {
      setSending(false);
    }
  }

  async function leave() {
    const ok = await confirm({
      title: "Sair do programa",
      description: "Você não poderá mais enviar cupons até aceitar o termo de novo. Os pontos já ganhos continuam com você.",
      confirmLabel: "Sair",
      variant: "destructive",
    });
    if (!ok) return;
    onChange(await api.delete<ReceiptRewardStatus>("/api/receipt-rewards/consent"));
    toast({ title: "Você saiu do programa", variant: "success" });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">Enviar cupom</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Aponte a câmera do celular para o QR Code do cupom, abra o link e cole o endereço aqui. Ou digite a chave de
          44 dígitos impressa no cupom.
        </p>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={3}
          placeholder="https://... ou 0000 0000 0000 ..."
          className="mt-3 w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            +{rules.pointsPerReceipt} pontos por cupom · hoje {usage.today}/{rules.dailyLimit} · 7 dias {usage.week}/
            {rules.weeklyLimit} · compras dos últimos {rules.maxAgeDays} dias
          </p>
          <Button type="button" onClick={() => void send()} loading={sending} disabled={code.trim().length < 20 || limitReached}>
            Enviar
          </Button>
        </div>
        {limitReached && <p className="mt-2 text-xs text-muted-foreground">Limite atingido por agora. Volte depois.</p>}
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Seus cupons</h2>
          <p className="text-sm text-muted-foreground">
            {totals.receipts} {totals.receipts === 1 ? "cupom" : "cupons"} · {totals.points} pontos
          </p>
        </div>
        {status.history.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhum cupom enviado ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {status.history.map((receipt) => (
              <li key={receipt.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-foreground">
                  {MODEL_LABEL[receipt.model] ?? "Cupom"} de {receipt.uf} · compra de {monthLabel(receipt.issuedMonth)}
                  <span className="block text-xs text-muted-foreground">enviado em {formatDate(receipt.createdAt)}</span>
                </span>
                <span className={receipt.status === "approved" ? "font-mono text-foreground" : "text-xs text-destructive"}>
                  {receipt.status === "approved" ? `+${receipt.points}` : "recusado"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="rounded-2xl border border-border/60 bg-card p-6 text-sm shadow-sm">
        <summary className="cursor-pointer font-semibold text-foreground">Termo do programa</summary>
        <div className="mt-4">
          <TermsText status={status} />
        </div>
        {status.consent.acceptedAt && (
          <p className="mt-4 text-xs text-muted-foreground">Você aceitou em {formatDate(status.consent.acceptedAt)}.</p>
        )}
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void leave()}>
          Sair do programa
        </Button>
      </details>
    </div>
  );
}
