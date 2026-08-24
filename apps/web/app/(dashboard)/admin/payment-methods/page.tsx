"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, QrCode, Check } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "password" | "select";
  secret?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
};

type PaymentMethod = {
  id: "mercadopago" | "pix";
  name: string;
  description: string;
  fields: FieldDef[];
  enabled: boolean;
  config: Record<string, string>;
  secretsSet: string[];
};

const ICONS: Record<string, typeof CreditCard> = {
  mercadopago: CreditCard,
  pix: QrCode,
};

export default function AdminPaymentMethodsPage() {
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<PaymentMethod[]>("/api/admin/payment-methods");
      setMethods(data);
      setSelectedId((current) => current ?? data[0]?.id ?? null);
    } catch {
      toast({ title: "Erro ao carregar métodos de pagamento", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const selected = methods.find((m) => m.id === selectedId) ?? null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <BackButton href="/admin" label="Administração" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Métodos de Pagamento</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Escolha um checkout para configurar suas credenciais e ativá-lo
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {methods.map((m) => {
          const Icon = ICONS[m.id] ?? CreditCard;
          const active = m.id === selectedId;
          return (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={cn(
                "text-left bg-card rounded-2xl border shadow-sm p-5 transition-shadow hover:shadow-md",
                active ? "border-primary ring-2 ring-primary/30" : "border-border/60"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Icon size={18} />
                </div>
                {m.enabled && (
                  <span className="flex items-center gap-1 text-xs font-medium text-success">
                    <Check size={12} /> Ativo
                  </span>
                )}
              </div>
              <p className="font-semibold text-foreground">{m.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
            </button>
          );
        })}
      </div>

      {selected && (
        <PaymentMethodForm
          key={selected.id}
          method={selected}
          onSaved={(updated) => {
            setMethods((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            toast({ title: "Configuração salva", variant: "success" });
          }}
        />
      )}
    </div>
  );
}

function PaymentMethodForm({
  method,
  onSaved,
}: {
  method: PaymentMethod;
  onSaved: (updated: PaymentMethod) => void;
}) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(method.enabled);
  const [enabledTouched, setEnabledTouched] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>(
    Object.fromEntries(method.fields.map((f) => [f.key, method.config[f.key] ?? ""]))
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.patch<PaymentMethod>(`/api/admin/payment-methods/${method.id}`, {
        // só envia enabled se o admin de fato tocou no toggle — caso contrário, o backend libera
        // automaticamente assim que os campos obrigatórios forem preenchidos
        enabled: enabledTouched ? enabled : undefined,
        config,
      });
      onSaved(updated);
    } catch {
      toast({ title: "Erro ao salvar configuração", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 max-w-xl">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold">{method.name}</h2>
        <ToggleRow
          enabled={enabled}
          onChange={(v) => {
            setEnabled(v);
            setEnabledTouched(true);
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground mb-5 -mt-3">
        Preencha os campos obrigatórios e salve — o método é liberado automaticamente para os usuários.
        Use o botão acima só para desativar manualmente.
      </p>

      <div className="space-y-4">
        {method.fields.map((field) => {
          const isMaskedSecret = field.secret && method.secretsSet.includes(field.key) && !config[field.key];
          if (field.type === "select") {
            return (
              <Select
                key={field.key}
                label={field.label}
                value={config[field.key] ?? ""}
                onChange={(e) => setConfig((c) => ({ ...c, [field.key]: e.target.value }))}
                options={field.options ?? []}
                placeholder="Selecione"
              />
            );
          }
          return (
            <Input
              key={field.key}
              type={field.type === "password" ? "password" : "text"}
              label={field.label}
              placeholder={isMaskedSecret ? "•••••••• (configurado — deixe em branco para manter)" : field.placeholder}
              value={config[field.key] ?? ""}
              onChange={(e) => setConfig((c) => ({ ...c, [field.key]: e.target.value }))}
            />
          );
        })}
      </div>

      <Button type="submit" loading={saving} className="mt-6 w-full">
        Salvar configuração
      </Button>
    </form>
  );
}

function ToggleRow({ enabled, onChange }: { enabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        enabled ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
          enabled ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}
