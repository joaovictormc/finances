"use client";

import { useId, useState } from "react";
import { CouponInputSchema, ReferralRuleInputSchema } from "@finances/validations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AdminCoupon = {
  id: string;
  code: string;
  description: string;
  discountType: "percent" | "fixed";
  percentOff: number | null;
  amountOffCents: number | null;
  plans: ("pro" | "familia")[];
  startsAt: string | null;
  expiresAt: string | null;
  maxRedemptions: number | null;
  active: boolean;
  confirmedUses: number;
  pendingUses: number;
};

export type AdminReferralRule = {
  id: string;
  name: string;
  isDefault: boolean;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  paidReferrerDays: number;
  freeRewardType: "plan_days" | "points" | "none";
  freeRewardPlan: "pro" | "familia";
  freeRewardDays: number;
  freeRewardPoints: number;
  isCurrent: boolean;
  referrals: number;
};

const control =
  "h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--color-primary)]"
      />
      {children}
    </label>
  );
}

/** "29,90" → 2990; vazio ou inválido → null. */
function reaisToCents(value: string): number | null {
  const n = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

const toInt = (v: string) => (v.trim() === "" ? null : Number.parseInt(v, 10));

function firstErrors(issues: { path: (string | number)[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) out[String(issue.path[0] ?? "")] ??= issue.message;
  return out;
}

// ── Cupom ────────────────────────────────────────────────────────────────────

export function CouponForm({
  initial,
  saving,
  onSubmit,
  onCancel,
}: {
  initial?: AdminCoupon;
  saving: boolean;
  onSubmit: (payload: unknown) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(initial?.discountType ?? "percent");
  const [percent, setPercent] = useState(initial?.percentOff ? String(initial.percentOff) : "");
  const [amount, setAmount] = useState(initial?.amountOffCents ? (initial.amountOffCents / 100).toFixed(2).replace(".", ",") : "");
  const [plans, setPlans] = useState<("pro" | "familia")[]>(initial?.plans ?? []);
  const [startsAt, setStartsAt] = useState(initial?.startsAt ?? "");
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ?? "");
  const [maxRedemptions, setMaxRedemptions] = useState(initial?.maxRedemptions ? String(initial.maxRedemptions) : "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const togglePlan = (plan: "pro" | "familia", on: boolean) =>
    setPlans((prev) => (on ? [...new Set([...prev, plan])] : prev.filter((p) => p !== plan)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      code,
      description,
      discountType,
      percentOff: discountType === "percent" ? toInt(percent) : null,
      amountOffCents: discountType === "fixed" ? reaisToCents(amount) : null,
      plans,
      startsAt: startsAt || null,
      expiresAt: expiresAt || null,
      maxRedemptions: toInt(maxRedemptions),
      active,
    };
    const parsed = CouponInputSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(firstErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
      <Field label="Código" error={errors.code} hint="O cliente digita no checkout. Letras, números, - e _.">
        {(id) => (
          <input id={id} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={30} className={cn(control, "font-mono uppercase")} />
        )}
      </Field>
      <Field label="Descrição interna" error={errors.description}>
        {(id) => <input id={id} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} className={control} />}
      </Field>
      <Field label="Tipo de desconto">
        {(id) => (
          <select id={id} value={discountType} onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")} className={control}>
            <option value="percent">Porcentagem</option>
            <option value="fixed">Valor fixo por cobrança</option>
          </select>
        )}
      </Field>
      {discountType === "percent" ? (
        <Field label="Desconto (%)" error={errors.percentOff}>
          {(id) => <input id={id} type="number" min={1} max={100} value={percent} onChange={(e) => setPercent(e.target.value)} className={control} />}
        </Field>
      ) : (
        <Field label="Desconto (R$ por cobrança)" error={errors.amountOffCents} hint="Ex.: 10,00. A cobrança nunca fica abaixo de R$ 1,00.">
          {(id) => <input id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={control} />}
        </Field>
      )}
      <Field label="Começa em" error={errors.startsAt} hint="Vazio: já vale.">
        {(id) => <input id={id} type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={control} />}
      </Field>
      <Field label="Vale até (inclusive)" error={errors.expiresAt} hint="Vazio: sem prazo.">
        {(id) => <input id={id} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={control} />}
      </Field>
      <Field label="Limite de usos" error={errors.maxRedemptions} hint="Contam só pagamentos confirmados. Vazio: sem limite.">
        {(id) => <input id={id} type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} className={control} />}
      </Field>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium text-foreground">Planos aceitos</legend>
        <div className="flex flex-wrap gap-x-5">
          <Check checked={plans.includes("pro")} onChange={(v) => togglePlan("pro", v)}>Pro</Check>
          <Check checked={plans.includes("familia")} onChange={(v) => togglePlan("familia", v)}>Família</Check>
        </div>
        <p className="text-xs text-muted-foreground">Nenhum marcado: vale para todos.</p>
      </fieldset>
      <div className="md:col-span-2">
        <Check checked={active} onChange={setActive}>Cupom ativo</Check>
      </div>
      <p className="text-xs text-muted-foreground md:col-span-2">
        O desconto vale para a assinatura inteira (todas as cobranças), no cartão e no Pix. Cada pessoa usa o cupom uma vez.
        Mudar o desconto não altera assinaturas já criadas.
      </p>
      <div className="flex justify-end gap-2 md:col-span-2">
        <Button type="button" variant="outline" onClick={onCancel} className="h-10">Cancelar</Button>
        <Button type="submit" loading={saving} className="h-10">{initial ? "Salvar cupom" : "Criar cupom"}</Button>
      </div>
    </form>
  );
}

// ── Regra de indicação ───────────────────────────────────────────────────────

export function ReferralRuleForm({
  initial,
  isDefault,
  saving,
  onSubmit,
  onCancel,
}: {
  initial?: AdminReferralRule;
  isDefault: boolean;
  saving: boolean;
  onSubmit: (payload: unknown) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [startsAt, setStartsAt] = useState(initial?.startsAt ?? "");
  const [endsAt, setEndsAt] = useState(initial?.endsAt ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [paidDays, setPaidDays] = useState(String(initial?.paidReferrerDays ?? 30));
  const [freeType, setFreeType] = useState<AdminReferralRule["freeRewardType"]>(initial?.freeRewardType ?? "plan_days");
  const [freePlan, setFreePlan] = useState<"pro" | "familia">(initial?.freeRewardPlan ?? "pro");
  const [freeDays, setFreeDays] = useState(String(initial?.freeRewardDays || 30));
  const [freePoints, setFreePoints] = useState(String(initial?.freeRewardPoints || 200));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: isDefault ? "Padrão" : name,
      startsAt: isDefault ? null : startsAt || null,
      endsAt: isDefault ? null : endsAt || null,
      active: isDefault ? true : active,
      paidReferrerDays: toInt(paidDays) ?? 0,
      freeRewardType: freeType,
      freeRewardPlan: freePlan,
      freeRewardDays: toInt(freeDays) ?? 0,
      freeRewardPoints: toInt(freePoints) ?? 0,
    };
    const parsed = ReferralRuleInputSchema.safeParse(payload);
    const next = parsed.success ? {} : firstErrors(parsed.error.issues);
    if (!isDefault && !startsAt) next.startsAt ??= "Informe o início";
    if (!isDefault && !endsAt) next.endsAt ??= "Informe o fim";
    setErrors(next);
    if (!parsed.success || Object.keys(next).length > 0) return;
    onSubmit(parsed.data);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
      {!isDefault && (
        <>
          <div className="md:col-span-2">
            <Field label="Nome da campanha" error={errors.name}>
              {(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Indique em outubro" className={control} />}
            </Field>
          </div>
          <Field label="Começa em" error={errors.startsAt}>
            {(id) => <input id={id} type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={control} />}
          </Field>
          <Field label="Termina em (inclusive)" error={errors.endsAt}>
            {(id) => <input id={id} type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={control} />}
          </Field>
        </>
      )}
      <div className="md:col-span-2">
        <Field
          label="Quem indica e já paga ganha (dias no próprio plano)"
          error={errors.paidReferrerDays}
          hint="0 = sem recompensa para quem já paga."
        >
          {(id) => <input id={id} type="number" min={0} max={365} value={paidDays} onChange={(e) => setPaidDays(e.target.value)} className={cn(control, "md:w-[calc(50%-0.5rem)]")} />}
        </Field>
      </div>
      <Field label="Quem indica e está no Free ganha">
        {(id) => (
          <select id={id} value={freeType} onChange={(e) => setFreeType(e.target.value as AdminReferralRule["freeRewardType"])} className={control}>
            <option value="plan_days">Dias de um plano pago</option>
            <option value="points">Pontos de gamificação</option>
            <option value="none">Nada</option>
          </select>
        )}
      </Field>
      {freeType === "plan_days" && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Plano">
            {(id) => (
              <select id={id} value={freePlan} onChange={(e) => setFreePlan(e.target.value as "pro" | "familia")} className={control}>
                <option value="pro">Pro</option>
                <option value="familia">Família</option>
              </select>
            )}
          </Field>
          <Field label="Dias" error={errors.freeRewardDays}>
            {(id) => <input id={id} type="number" min={1} max={365} value={freeDays} onChange={(e) => setFreeDays(e.target.value)} className={control} />}
          </Field>
        </div>
      )}
      {freeType === "points" && (
        <Field label="Pontos" error={errors.freeRewardPoints}>
          {(id) => <input id={id} type="number" min={1} value={freePoints} onChange={(e) => setFreePoints(e.target.value)} className={control} />}
        </Field>
      )}
      {!isDefault && (
        <div className="md:col-span-2">
          <Check checked={active} onChange={setActive}>Campanha ativa</Check>
        </div>
      )}
      <p className="text-xs text-muted-foreground md:col-span-2">
        A recompensa sai quando a pessoa indicada assina um plano pago pela primeira vez, pela regra que valia no dia em que ela
        se cadastrou{isDefault ? " (sem campanha vigente, vale esta)" : ""}. Editar uma regra muda também a recompensa de quem já
        foi indicado por ela e ainda não assinou.
      </p>
      <div className="flex justify-end gap-2 md:col-span-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} className="h-10">Cancelar</Button>}
        <Button type="submit" loading={saving} className="h-10">{isDefault ? "Salvar regra padrão" : initial ? "Salvar campanha" : "Criar campanha"}</Button>
      </div>
    </form>
  );
}
