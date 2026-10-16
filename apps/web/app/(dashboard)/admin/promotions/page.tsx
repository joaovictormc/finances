"use client";

import { useCallback, useEffect, useState } from "react";
import { PencilLine, Trash2 } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-provider";
import { api } from "@/lib/api-client";
import { formatBRL } from "@/lib/utils";
import {
  CouponForm,
  ReferralRuleForm,
  type AdminCoupon,
  type AdminReferralRule,
} from "@/components/admin/promotions/forms";

const PLAN_NAMES: Record<string, string> = { pro: "Pro", familia: "Família" };
const day = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : null);

function discountLabel(c: AdminCoupon) {
  return c.discountType === "percent" ? `${c.percentOff}% de desconto` : `${formatBRL((c.amountOffCents ?? 0) / 100)} de desconto`;
}

function periodLabel(start: string | null, end: string | null) {
  if (start && end) return `${day(start)} a ${day(end)}`;
  if (end) return `até ${day(end)}`;
  if (start) return `a partir de ${day(start)}`;
  return "sem prazo";
}

function freeRewardLabel(r: AdminReferralRule) {
  if (r.freeRewardType === "plan_days") return `${r.freeRewardDays} dias de ${PLAN_NAMES[r.freeRewardPlan]}`;
  if (r.freeRewardType === "points") return `${r.freeRewardPoints} pontos`;
  return "nada";
}

export default function AdminPromotionsPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [coupons, setCoupons] = useState<AdminCoupon[] | null>(null);
  const [rules, setRules] = useState<AdminReferralRule[] | null>(null);
  const [editingCoupon, setEditingCoupon] = useState<AdminCoupon | "new" | null>(null);
  const [editingRule, setEditingRule] = useState<AdminReferralRule | "new" | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([
        api.get<AdminCoupon[]>("/api/admin/promotions/coupons"),
        api.get<AdminReferralRule[]>("/api/admin/promotions/referral-rules"),
      ]);
      setCoupons(c);
      setRules(r);
    } catch {
      toast({ title: "Erro ao carregar promoções", variant: "error" });
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, success: string, after?: () => void) {
    setSaving(true);
    try {
      await action();
      toast({ title: success, variant: "success" });
      after?.();
      await load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Não foi possível salvar", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (!coupons || !rules) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const defaultRule = rules.find((r) => r.isDefault)!;
  const campaigns = rules.filter((r) => !r.isDefault);

  return (
    <div className="max-w-4xl">
      <BackButton href="/admin" label="Administração" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Promoções</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cupons de desconto e recompensa de quem indica o app</p>
      </div>

      {/* ── Cupons ── */}
      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Cupons de desconto</h2>
            <p className="text-sm text-muted-foreground">O cliente digita o código na tela de planos.</p>
          </div>
          {editingCoupon === null && (
            <Button type="button" onClick={() => setEditingCoupon("new")} className="h-10">
              Novo cupom
            </Button>
          )}
        </div>

        {editingCoupon !== null && (
          <div className="mb-6 rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
            <CouponForm
              key={editingCoupon === "new" ? "new" : editingCoupon.id}
              initial={editingCoupon === "new" ? undefined : editingCoupon}
              saving={saving}
              onCancel={() => setEditingCoupon(null)}
              onSubmit={(payload) =>
                void run(
                  () =>
                    editingCoupon === "new"
                      ? api.post("/api/admin/promotions/coupons", payload)
                      : api.patch(`/api/admin/promotions/coupons/${editingCoupon.id}`, payload),
                  editingCoupon === "new" ? "Cupom criado" : "Cupom salvo",
                  () => setEditingCoupon(null)
                )
              }
            />
          </div>
        )}

        {coupons.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum cupom criado ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {coupons.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-semibold text-foreground">
                    {c.code}
                    {!c.active && <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">desativado</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {discountLabel(c)} · {c.plans.length ? c.plans.map((p) => PLAN_NAMES[p]).join(" e ") : "todos os planos"} ·{" "}
                    {periodLabel(c.startsAt, c.expiresAt)}
                  </p>
                </div>
                <p className="text-sm text-foreground">
                  {c.confirmedUses}
                  {c.maxRedemptions ? `/${c.maxRedemptions}` : ""} usos
                  {c.pendingUses > 0 && <span className="text-xs text-muted-foreground"> · {c.pendingUses} aguardando pagamento</span>}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingCoupon(c)}
                    aria-label={`Editar cupom ${c.code}`}
                    className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <PencilLine size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!(await confirm({ title: "Excluir cupom", description: `Excluir ${c.code}?`, confirmLabel: "Excluir", variant: "destructive" }))) return;
                      void run(() => api.delete(`/api/admin/promotions/coupons/${c.id}`), "Cupom excluído");
                    }}
                    aria-label={`Excluir cupom ${c.code}`}
                    className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Indicação ── */}
      <section className="mt-6 rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">Recompensa de indicação</h2>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">
          Vale agora: <strong className="font-medium text-foreground">{rules.find((r) => r.isCurrent)?.name}</strong>. Uma
          campanha ativa no período substitui a regra padrão.
        </p>

        <h3 className="mb-3 text-sm font-semibold">Regra padrão</h3>
        <div className="rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
          <ReferralRuleForm
            key={`default-${defaultRule.id}-${defaultRule.paidReferrerDays}-${defaultRule.freeRewardType}`}
            initial={defaultRule}
            isDefault
            saving={saving}
            onSubmit={(payload) =>
              void run(() => api.patch(`/api/admin/promotions/referral-rules/${defaultRule.id}`, payload), "Regra padrão salva")
            }
          />
        </div>

        <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Campanhas</h3>
          {editingRule === null && (
            <Button type="button" variant="outline" onClick={() => setEditingRule("new")} className="h-10">
              Nova campanha
            </Button>
          )}
        </div>

        {editingRule !== null && (
          <div className="mb-4 rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
            <ReferralRuleForm
              key={editingRule === "new" ? "new" : editingRule.id}
              initial={editingRule === "new" ? undefined : editingRule}
              isDefault={false}
              saving={saving}
              onCancel={() => setEditingRule(null)}
              onSubmit={(payload) =>
                void run(
                  () =>
                    editingRule === "new"
                      ? api.post("/api/admin/promotions/referral-rules", payload)
                      : api.patch(`/api/admin/promotions/referral-rules/${editingRule.id}`, payload),
                  editingRule === "new" ? "Campanha criada" : "Campanha salva",
                  () => setEditingRule(null)
                )
              }
            />
          </div>
        )}

        {campaigns.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhuma campanha. Crie uma para mudar a recompensa por um período (ex.: um mês de lançamento).
          </p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {campaigns.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {r.name}
                    {r.isCurrent && (
                      <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-foreground">vigente</span>
                    )}
                    {!r.active && <span className="ml-2 text-xs font-normal text-muted-foreground">desativada</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {periodLabel(r.startsAt, r.endsAt)} · quem paga: {r.paidReferrerDays} dias · quem está no Free: {freeRewardLabel(r)}
                  </p>
                </div>
                <p className="text-sm text-foreground">{r.referrals} indicações</p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingRule(r)}
                    aria-label={`Editar campanha ${r.name}`}
                    className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <PencilLine size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!(await confirm({ title: "Excluir campanha", description: `Excluir "${r.name}"?`, confirmLabel: "Excluir", variant: "destructive" }))) return;
                      void run(() => api.delete(`/api/admin/promotions/referral-rules/${r.id}`), "Campanha excluída");
                    }}
                    aria-label={`Excluir campanha ${r.name}`}
                    className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
