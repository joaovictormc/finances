"use client";

import { useCallback, useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

type PaymentEvent = {
  id: string;
  mpEventId: string;
  type: string;
  rawPayload: unknown;
  processedAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  checkout_created: "Checkout iniciado",
  admin_plan_override: "Plano alterado (admin, gratuito)",
  admin_subscription_cancel: "Assinatura cancelada (admin)",
  subscription_preapproval: "Assinatura (Mercado Pago)",
  payment: "Pagamento (Mercado Pago)",
  pix_checkout_created: "Checkout Pix iniciado (pendente)",
  pix_payment_confirmed: "Pagamento Pix confirmado",
};

export default function AdminCheckoutsPage() {
  const { toast } = useToast();
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get<string[]>("/api/admin/payment-events/types").then(setTypes).catch(() => {});
  }, []);

  const load = useCallback(async (p: number, type: string) => {
    setIsLoading(true);
    try {
      const data = await api.get<{ events: PaymentEvent[]; total: number; pageSize: number }>(
        "/api/admin/payment-events",
        type ? { page: p, type } : { page: p }
      );
      setEvents(data.events);
      setTotal(data.total);
    } catch {
      toast({ title: "Erro ao carregar eventos de checkout", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(page, typeFilter); }, [load, page, typeFilter]);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function handleConfirmPix(eventId: string) {
    setConfirmingId(eventId);
    try {
      await api.post(`/api/admin/payment-events/${eventId}/confirm-pix`, {});
      toast({ title: "Pagamento Pix confirmado e plano ativado", variant: "success" });
      load(page, typeFilter);
    } catch (err) {
      toast({ title: (err as Error).message || "Erro ao confirmar pagamento", variant: "error" });
    } finally {
      setConfirmingId(null);
    }
  }

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <BackButton href="/admin" label="Administração" />
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Checkouts</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Histórico de eventos de cobrança — inclui webhooks reais do Mercado Pago e alterações
            gratuitas feitas pelo admin
          </p>
        </div>
        {types.length > 0 && (
          <Select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="w-64"
            options={[
              { value: "", label: "Todos os tipos" },
              ...types.map((t) => ({ value: t, label: TYPE_LABELS[t] ?? t })),
            ]}
          />
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : events.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm">
          <EmptyState icon={Receipt} title="Nenhum evento de checkout ainda" />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {events.map((ev) => (
              <details key={ev.id} className="bg-card rounded-xl border border-border/60 shadow-sm p-4">
                <summary className="cursor-pointer flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">{TYPE_LABELS[ev.type] ?? ev.type}</span>
                  <span className="text-muted-foreground text-xs">{formatDate(ev.processedAt)}</span>
                </summary>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  {JSON.stringify(ev.rawPayload, null, 2)}
                </pre>
                {ev.type === "pix_checkout_created" && (
                  <Button
                    size="sm"
                    className="mt-3"
                    loading={confirmingId === ev.id}
                    onClick={() => handleConfirmPix(ev.id)}
                  >
                    Confirmar pagamento e ativar plano
                  </Button>
                )}
              </details>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
