"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast-provider";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

/** Intervalo da checagem. Não há push: a campainha pergunta, não é avisada. */
const POLL_MS = 60_000;

/** Tipos que são alerta e não notícia neutra — muda só a cor do pop-up. */
const ALERT_TYPES = new Set([
  "pix_checkout_pending",
  "budget_alert",
  "overdraft_warning",
  "bill_reminder",
]);

function relativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * `openUpward` decide o lado do painel: na sidebar a campainha fica no rodapé
 * e só há espaço acima; no cabeçalho mobile é o contrário. Prop em vez de
 * breakpoint porque a posição depende de onde o componente foi montado, não
 * do tamanho da tela.
 */
export function NotificationBell({
  collapsed = false,
  openUpward = false,
}: {
  collapsed?: boolean;
  openUpward?: boolean;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // null enquanto não houve a primeira carga — ver comentário dentro do load.
  const seenIds = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ items: Notification[]; unread: number }>("/api/notifications");
      setItems(data.items);
      setUnread(data.unread);

      const unreadItems = data.items.filter((item) => !item.readAt);

      if (seenIds.current === null) {
        // A primeira carga só registra o que já existe: sem isso, todo refresh
        // de página repetiria como pop-up tudo que estava pendente.
        seenIds.current = new Set(unreadItems.map((item) => item.id));
        return;
      }

      const fresh = unreadItems.filter((item) => !seenIds.current?.has(item.id));
      for (const item of fresh) seenIds.current.add(item.id);

      const first = fresh[0];
      if (first) {
        toast({
          title: first.title,
          description: fresh.length > 1 ? `E mais ${fresh.length - 1} aviso(s) novo(s).` : first.body,
          variant: ALERT_TYPES.has(first.type) ? "warning" : "info",
        });
      }
    } catch {
      // A campainha é acessório: falha de rede aqui não pode virar erro na tela.
    }
  }, [toast]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    // Aba em segundo plano não precisa consultar; ao voltar, atualiza na hora.
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  async function markRead(id: string) {
    // Otimista: a lista responde na hora, e um erro só recarrega o estado real.
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item))
    );
    setUnread((prev) => Math.max(0, prev - 1));
    try {
      await api.post(`/api/notifications/${id}/read`, {});
    } catch {
      void load();
    }
  }

  async function markAll() {
    setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnread(0);
    try {
      await api.post("/api/notifications/read-all", {});
    } catch {
      void load();
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="Notificações"
        aria-label={unread > 0 ? `Notificações (${unread} não lidas)` : "Notificações"}
        aria-expanded={open}
        className={cn(
          "relative flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          collapsed ? "h-9 w-9" : "h-8 w-8"
        )}
      >
        <Bell size={collapsed ? 18 : 16} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-card shadow-lg",
            // Abre pra cima na sidebar (a campainha fica no rodapé) e pra baixo
            // no cabeçalho mobile, onde não há espaço acima.
            openUpward ? "bottom-full mb-2 left-0" : "top-full mt-2 right-0"
          )}
        >
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <span className="text-sm font-semibold text-foreground">Notificações</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <CheckCheck size={13} />
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                Nenhuma notificação por aqui.
              </p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => !item.readAt && markRead(item.id)}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 border-b border-border/40 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-accent/50",
                    !item.readAt && "bg-primary/5"
                  )}
                >
                  <span className="flex w-full items-center gap-2">
                    {!item.readAt && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {item.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {relativeTime(item.createdAt)}
                    </span>
                  </span>
                  <span className="whitespace-pre-line text-xs text-muted-foreground">{item.body}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
