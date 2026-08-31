"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Send, Sparkles, Trash2, Wrench } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";
import { AgentManager, type Agent } from "./agent-manager";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: string[] | null;
  createdAt: string;
};

type Conversation = {
  id: string;
  title: string;
  agentId: string | null;
  lastMessageAt: string;
  agent?: { id: string; name: string; icon: string | null } | null;
};

type ConversationDetail = Conversation & { messages: Message[] };

const SUGGESTIONS = [
  "Quanto gastei esse mês?",
  "Qual o saldo das minhas contas?",
  "Como estão meus orçamentos?",
  "Quais contas vencem em breve?",
];

export function AssistantChat() {
  const { toast } = useToast();
  const confirm = useConfirm();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  // O banco guarda o nome técnico da ferramenta (bom pra depurar); a tela
  // mostra o rótulo amigável que a própria API expõe em /tools.
  const [toolLabels, setToolLabels] = useState<Record<string, string>>({});

  const scrollRef = useRef<HTMLDivElement>(null);

  const loadSidebar = useCallback(async () => {
    try {
      const [convs, ags, tools] = await Promise.all([
        api.get<Conversation[]>("/api/assistant/conversations"),
        api.get<Agent[]>("/api/assistant/agents"),
        api.get<{ name: string; label: string }[]>("/api/assistant/tools"),
      ]);
      setConversations(convs);
      setAgents(ags);
      setToolLabels(Object.fromEntries(tools.map((t) => [t.name, t.label])));
    } catch {
      toast({ title: "Erro ao carregar o assistente", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSidebar();
  }, [loadSidebar]);

  // Rola pro fim a cada mensagem nova — o histórico cresce por baixo.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function openConversation(id: string) {
    setActiveId(id);
    setMessages([]);
    try {
      const detail = await api.get<ConversationDetail>(`/api/assistant/conversations/${id}`);
      setMessages(detail.messages);
      setSelectedAgentId(detail.agentId ?? "");
    } catch {
      toast({ title: "Erro ao abrir a conversa", variant: "error" });
    }
  }

  function startNew() {
    setActiveId(null);
    setMessages([]);
  }

  async function handleSend(text: string) {
    const content = text.trim();
    if (!content || sending) return;

    setSending(true);
    setDraft("");

    // Mostra a pergunta na hora; o servidor só persiste quando tiver resposta.
    const optimistic: Message = {
      id: `local-${Date.now()}`,
      role: "user",
      content,
      toolCalls: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      let conversationId = activeId;

      if (!conversationId) {
        const created = await api.post<Conversation>("/api/assistant/conversations", {
          title: content,
          ...(selectedAgentId && { agentId: selectedAgentId }),
        });
        conversationId = created.id;
        setActiveId(created.id);
      }

      const answer = await api.post<Message>(
        `/api/assistant/conversations/${conversationId}/messages`,
        { content }
      );
      setMessages((prev) => [...prev, answer]);
      loadSidebar();
    } catch (err) {
      // Tira a pergunta otimista: ela não foi gravada no servidor, e deixá-la
      // na tela daria a impressão de que a conversa continuou.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(content);
      toast({
        title: "Não consegui responder",
        description: (err as Error).message,
        variant: "error",
      });
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Excluir conversa",
      description: "O histórico dessa conversa será apagado.",
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await api.delete(`/api/assistant/conversations/${id}`);
      if (activeId === id) startNew();
      loadSidebar();
    } catch {
      toast({ title: "Erro ao excluir", variant: "error" });
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  const activeAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* ── Conversas e agentes ───────────────────────────────────────────── */}
      <aside className="bg-card rounded-2xl border border-border/60 shadow-sm p-3 flex flex-col gap-3 lg:h-[calc(100vh-11rem)]">
        <Button onClick={startNew} className="w-full justify-center">
          <Plus size={16} /> Nova conversa
        </Button>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-4 text-center">
              Nenhuma conversa ainda.
            </p>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                role="button"
                tabIndex={0}
                onClick={() => openConversation(conversation.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") openConversation(conversation.id);
                }}
                className={cn(
                  "group flex items-center gap-1 rounded-lg px-2 py-2 text-sm cursor-pointer",
                  conversation.id === activeId ? "bg-muted" : "hover:bg-muted/60"
                )}
              >
                <span className="flex-1 truncate">
                  {conversation.agent?.icon ? `${conversation.agent.icon} ` : ""}
                  {conversation.title}
                </span>
                <button
                  type="button"
                  aria-label="Excluir conversa"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(conversation.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <Button variant="outline" onClick={() => setAgentsOpen(true)} className="w-full justify-center">
          <Wrench size={15} /> Agentes ({agents.length})
        </Button>
      </aside>

      {/* ── Chat ──────────────────────────────────────────────────────────── */}
      <section className="bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col lg:h-[calc(100vh-11rem)]">
        {/* O agente é escolhido na criação; conversa existente já tem o dele. */}
        {!activeId && (
          <div className="border-b border-border/60 p-3">
            <label htmlFor="agent" className="text-xs text-muted-foreground">
              Agente
            </label>
            <select
              id="agent"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Assistente geral (todas as ferramentas)</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.icon ? `${agent.icon} ` : ""}
                  {agent.name}
                </option>
              ))}
            </select>
            {activeAgent && activeAgent.enabledTools.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Este agente consulta apenas {activeAgent.enabledTools.length} das ferramentas
                disponíveis.
              </p>
            )}
          </div>
        )}

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !sending ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4">
              <Sparkles size={28} className="text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Pergunte sobre suas finanças</p>
                <p className="text-sm text-muted-foreground mt-1">
                  O assistente consulta seus dados reais antes de responder.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-md">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSend(suggestion)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {message.content}
                  {message.toolCalls && message.toolCalls.length > 0 && (
                    <p className="mt-2 text-xs opacity-70">
                      Consultei:{" "}
                      {[...new Set(message.toolCalls)]
                        .map((name) => toolLabels[name] ?? name)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}

          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner size="sm" /> Consultando seus dados...
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(draft);
          }}
          className="border-t border-border/60 p-3 flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Pergunte sobre seus gastos, orçamentos ou metas..."
            maxLength={2000}
            className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Button type="submit" loading={sending} disabled={!draft.trim()}>
            <Send size={16} />
          </Button>
        </form>
      </section>

      <AgentManager
        open={agentsOpen}
        onClose={() => setAgentsOpen(false)}
        agents={agents}
        onChanged={loadSidebar}
      />
    </div>
  );
}
