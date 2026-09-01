"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Bell, CheckCheck, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-provider";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

/** Intervalo da checagem. Não há push: a campainha pergunta, não é avisada. */
const POLL_MS = 60_000;

const PANEL_WIDTH = 320;
const PANEL_MARGIN = 8;

/** Tipos que são alerta e não notícia neutra — muda só a cor do pop-up. */
const ALERT_TYPES = new Set([
  "pix_checkout_pending",
  "budget_alert",
  "overdraft_warning",
  "bill_reminder",
]);

/**
 * Destino por tipo, para as notificações gravadas antes de cada emissor passar
 * a mandar o próprio link. Quem emite hoje manda o destino exato — e precisa
 * mandar, porque o tipo não basta: `insight_ready` sai tanto do insight mensal
 * quanto da conta recorrente detectada, que vão pra telas diferentes.
 */
const FALLBACK_LINKS: Record<string, string> = {
  insight_ready: "/overview",
  budget_alert: "/budgets",
  overdraft_warning: "/accounts",
  bill_reminder: "/bills",
  goal_milestone: "/goals",
  group_activity: "/groups",
  referral_reward: "/rewards",
  pix_checkout_pending: "/admin/checkouts",
};

function linkFor(item: Notification): string | null {
  const stored = item.metadata?.link;
  // Só caminho interno: aceitar URL absoluta aqui transformaria o campo num
  // redirecionador aberto para qualquer coisa que consiga gravar metadata.
  if (typeof stored === "string" && stored.startsWith("/") && !stored.startsWith("//")) {
    return stored;
  }
  return FALLBACK_LINKS[item.type] ?? null;
}

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
 * Posição fixa do painel, calculada a partir do botão.
 *
 * O painel vai num portal no body porque a sidebar tem `overflow-hidden` (a
 * transição de recolher depende disso) e mede 240px — um painel de 320px
 * posicionado dentro dela nascia cortado. `fixed` + portal ignora qualquer
 * ancestral que corte.
 *
 * A direção sai do espaço disponível em vez de uma prop: a campainha no rodapé
 * da sidebar abre pra cima e a do cabeçalho mobile abre pra baixo sem ninguém
 * precisar declarar isso.
 */
function panelStyle(anchor: DOMRect): CSSProperties {
  const width = Math.min(PANEL_WIDTH, window.innerWidth - PANEL_MARGIN * 2);
  const spaceBelow = window.innerHeight - anchor.bottom;
  const spaceAbove = anchor.top;
  const upward = spaceAbove > spaceBelow;

  // Alinha por uma das bordas do botão, mas sem deixar sair da tela.
  const preferredLeft = upward ? anchor.left : anchor.right - width;
  const left = Math.min(
    Math.max(PANEL_MARGIN, preferredLeft),
    Math.max(PANEL_MARGIN, window.innerWidth - width - PANEL_MARGIN)
  );

  return upward
    ? {
        left,
        width,
        bottom: window.innerHeight - anchor.top + PANEL_MARGIN,
        maxHeight: spaceAbove - PANEL_MARGIN * 3,
      }
    : {
        left,
        width,
        top: anchor.bottom + PANEL_MARGIN,
        maxHeight: spaceBelow - PANEL_MARGIN * 3,
      };
}

export function NotificationBell({ collapsed = false }: { collapsed?: boolean }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
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

  const updateAnchor = useCallback(() => {
    const button = buttonRef.current;
    if (button) setAnchor(button.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (!open) return;
    updateAnchor();
    window.addEventListener("resize", updateAnchor);
    // Em captura: quem rola é o <main>, não a janela — sem isso o painel
    // ficaria parado enquanto o botão se move.
    window.addEventListener("scroll", updateAnchor, true);
    return () => {
      window.removeEventListener("resize", updateAnchor);
      window.removeEventListener("scroll", updateAnchor, true);
    };
  }, [open, updateAnchor]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      // O painel vive num portal, fora da árvore do botão: precisa das duas
      // checagens, senão clicar dentro dele fecharia o painel.
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
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

  async function clearAll() {
    // Fecha o painel antes de perguntar: o diálogo fica fora dele, e o
    // clique-fora fecharia o painel no meio da pergunta de qualquer jeito.
    setOpen(false);

    const confirmed = await confirm({
      title: "Limpar notificações",
      description: `Isso apaga as ${items.length} notificações da sua lista, inclusive as não lidas. Não dá pra desfazer.`,
      confirmLabel: "Limpar tudo",
      variant: "destructive",
    });
    if (!confirmed) return;

    setItems([]);
    setUnread(0);
    // `seenIds` fica como está de propósito: zerar faria o próximo ciclo tratar
    // como novidade tudo que voltasse caso a exclusão falhasse no servidor.
    try {
      await api.delete<{ count: number }>("/api/notifications");
    } catch {
      void load();
    }
  }

  function handleItemClick(item: Notification) {
    if (!item.readAt) void markRead(item.id);

    const link = linkFor(item);
    if (!link) return;
    setOpen(false);
    router.push(link);
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

  const panel =
    open && anchor
      ? createPortal(
          <div
            ref={panelRef}
            style={panelStyle(anchor)}
            className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-2">
              <span className="text-sm font-semibold text-foreground">Notificações</span>
              <span className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={markAll}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <CheckCheck size={13} />
                    Marcar todas
                  </button>
                )}
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    title="Limpar todas as notificações"
                    aria-label="Limpar todas as notificações"
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Nenhuma notificação por aqui.
                </p>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className={cn(
                      "group flex w-full flex-col items-start gap-0.5 border-b border-border/40 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-accent/50",
                      !item.readAt && "bg-primary/5",
                      linkFor(item) ? "cursor-pointer" : "cursor-default"
                    )}
                  >
                    <span className="flex w-full items-center gap-2">
                      {!item.readAt && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {item.title}
                      </span>
                      {linkFor(item) && (
                        <ArrowUpRight
                          size={13}
                          className="shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground"
                        />
                      )}
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {relativeTime(item.createdAt)}
                      </span>
                    </span>
                    <span className="whitespace-pre-line text-xs text-muted-foreground">{item.body}</span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="Notificações"
        aria-label={unread > 0 ? `Notificações (${unread} não lidas)` : "Notificações"}
        aria-expanded={open}
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
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
      {panel}
    </>
  );
}
