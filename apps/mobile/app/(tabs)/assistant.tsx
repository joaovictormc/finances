import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api-client";
import { Screen } from "@/components/screen";
import { formatDate } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import type { Subscription } from "@/lib/types";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: string[] | null;
};

type Agent = { id: string; name: string; icon: string | null };

type Conversation = {
  id: string;
  title: string;
  agentId: string | null;
  lastMessageAt: string;
  agent?: Agent | null;
};

type ConversationDetail = Conversation & { messages: Message[] };

const SUGGESTIONS = [
  "Quanto gastei esse mês?",
  "Qual o saldo das minhas contas?",
  "Como estão meus orçamentos?",
];

export default function AssistantScreen() {
  const { colors } = useTheme();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // O banco guarda o nome técnico da ferramenta (bom pra depurar); a tela
  // mostra o rótulo amigável que a própria API expõe em /tools.
  const [toolLabels, setToolLabels] = useState<Record<string, string>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  const loadHistory = useCallback(() => {
    api
      .get<Conversation[]>("/api/assistant/conversations")
      .then(setConversations)
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      api
        .get<Subscription>("/api/billing/subscription")
        .then((sub) => setAllowed(sub.plan !== "free" || Boolean(sub.hasIntegrationsModule)))
        .catch(() => setAllowed(false));

      api
        .get<{ name: string; label: string }[]>("/api/assistant/tools")
        .then((tools) => setToolLabels(Object.fromEntries(tools.map((t) => [t.name, t.label]))))
        .catch(() => {});

      api.get<Agent[]>("/api/assistant/agents").then(setAgents).catch(() => {});
      loadHistory();
    }, [loadHistory])
  );

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, sending]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;

    setSending(true);
    setError(null);
    setDraft("");

    // Mostra a pergunta na hora; o servidor só persiste quando tiver resposta.
    const optimistic: Message = { id: `local-${Date.now()}`, role: "user", content, toolCalls: null };
    setMessages((prev) => [...prev, optimistic]);

    try {
      let id = conversationId;
      if (!id) {
        const created = await api.post<Conversation>("/api/assistant/conversations", {
          title: content,
          ...(selectedAgentId && { agentId: selectedAgentId }),
        });
        id = created.id;
        setConversationId(created.id);
      }

      const answer = await api.post<Message>(`/api/assistant/conversations/${id}/messages`, {
        content,
      });
      setMessages((prev) => [...prev, answer]);
      loadHistory(); // o título e a data da conversa mudaram
    } catch (err) {
      // A pergunta não foi gravada no servidor; mantê-la na tela daria a
      // impressão falsa de que a conversa continuou.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(content);
      setError(err instanceof Error ? err.message : "Não consegui responder.");
    } finally {
      setSending(false);
    }
  }

  function startNew() {
    setConversationId(null);
    setMessages([]);
    setSelectedAgentId(null);
    setError(null);
    setHistoryOpen(false);
  }

  async function openConversation(id: string) {
    setHistoryOpen(false);
    setLoadingConversation(true);
    setError(null);
    try {
      const detail = await api.get<ConversationDetail>(`/api/assistant/conversations/${id}`);
      setConversationId(detail.id);
      setSelectedAgentId(detail.agentId);
      setMessages(detail.messages);
    } catch {
      setError("Não consegui abrir essa conversa.");
    } finally {
      setLoadingConversation(false);
    }
  }

  function confirmDeleteConversation(conversation: Conversation) {
    Alert.alert(`Excluir "${conversation.title}"`, "As mensagens dessa conversa serão apagadas.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/api/assistant/conversations/${conversation.id}`);
            if (conversation.id === conversationId) startNew();
            loadHistory();
          } catch {
            setError("Erro ao excluir a conversa.");
          }
        },
      },
    ]);
  }

  const activeAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;

  if (allowed === null) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!allowed) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Ionicons name="lock-closed-outline" size={28} color={colors.mutedForeground} />
          <Text className="text-center text-base font-semibold text-foreground dark:text-foreground-dark">
            Disponível nos planos Pro e Família
          </Text>
          <Text className="text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
            O assistente consulta seus gastos, orçamentos e contas para responder perguntas e
            ajudar no planejamento.
          </Text>
          <Pressable
            onPress={() => router.push("/billing")}
            className="rounded-md bg-primary px-4 py-3 dark:bg-primary-dark"
          >
            <Text className="font-medium text-primary-foreground dark:text-primary-foreground-dark">
              Ver planos
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-row items-center justify-between px-4 pb-2">
        <Text className="text-xl font-bold text-foreground dark:text-foreground-dark">
          Assistente
        </Text>
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => {
              loadHistory();
              setHistoryOpen(true);
            }}
            accessibilityLabel="Conversas anteriores"
          >
            <Ionicons name="time-outline" size={22} color={colors.mutedForeground} />
          </Pressable>
          <Pressable onPress={() => router.push("/assistant-agents")} accessibilityLabel="Agentes">
            <Ionicons name="construct-outline" size={22} color={colors.mutedForeground} />
          </Pressable>
          <Pressable onPress={startNew} accessibilityLabel="Nova conversa">
            <Ionicons name="create-outline" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {conversationId && activeAgent && (
        <View className="mx-4 mb-2 flex-row items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 dark:border-border-dark dark:bg-card-dark">
          <Text className="text-sm">{activeAgent.icon || "🤖"}</Text>
          <Text className="flex-1 text-xs text-muted-foreground dark:text-muted-foreground-dark">
            Conversando com {activeAgent.name}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ padding: 16, gap: 12 }}
        >
          {loadingConversation ? (
            <View className="items-center py-10">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : messages.length === 0 && !sending ? (
            <View className="items-center gap-4 pt-16">
              <Ionicons name="sparkles-outline" size={28} color={colors.mutedForeground} />
              <Text className="text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
                O assistente consulta seus dados reais antes de responder.
              </Text>
              <View className="gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => send(suggestion)}
                    className="rounded-full border border-border px-4 py-2 dark:border-border-dark"
                  >
                    <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                      {suggestion}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {agents.length > 0 && (
                <View className="mt-2 items-center gap-2">
                  <Text className="text-[11px] uppercase tracking-wide text-muted-foreground dark:text-muted-foreground-dark">
                    Ou fale com um agente
                  </Text>
                  <View className="flex-row flex-wrap justify-center gap-2">
                    {agents.map((agent) => {
                      const active = selectedAgentId === agent.id;
                      return (
                        <Pressable
                          key={agent.id}
                          onPress={() => setSelectedAgentId(active ? null : agent.id)}
                          className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${
                            active
                              ? "border-primary bg-primary/10 dark:border-primary-dark"
                              : "border-border dark:border-border-dark"
                          }`}
                        >
                          <Text className="text-xs">{agent.icon || "🤖"}</Text>
                          <Text className="text-xs text-foreground dark:text-foreground-dark">
                            {agent.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          ) : (
            messages.map((message) => (
              <View
                key={message.id}
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  message.role === "user"
                    ? "self-end bg-primary dark:bg-primary-dark"
                    : "self-start bg-muted dark:bg-muted-dark"
                }`}
              >
                <Text
                  className={
                    message.role === "user"
                      ? "text-sm text-primary-foreground dark:text-primary-foreground-dark"
                      : "text-sm text-foreground dark:text-foreground-dark"
                  }
                >
                  {message.content}
                </Text>
                {message.toolCalls && message.toolCalls.length > 0 && (
                  <Text className="mt-2 text-[11px] text-muted-foreground dark:text-muted-foreground-dark">
                    Consultei:{" "}
                    {[...new Set(message.toolCalls)]
                      .map((name) => toolLabels[name] ?? name)
                      .join(" · ")}
                  </Text>
                )}
              </View>
            ))
          )}

          {sending && (
            <View className="flex-row items-center gap-2 self-start">
              <ActivityIndicator size="small" color={colors.primary} />
              <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
                Consultando seus dados...
              </Text>
            </View>
          )}

          {error && (
            <Text className="text-sm text-destructive dark:text-destructive-dark">{error}</Text>
          )}
        </ScrollView>

        <View className="flex-row gap-2 border-t border-border px-4 py-3 dark:border-border-dark">
          <TextInput
            className="flex-1 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
            placeholder="Pergunte sobre suas finanças..."
            placeholderTextColor={colors.mutedForeground}
            maxLength={2000}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => send(draft)}
          />
          <Pressable
            onPress={() => send(draft)}
            disabled={sending || !draft.trim()}
            className="items-center justify-center rounded-md bg-primary px-4 dark:bg-primary-dark"
            style={{ opacity: sending || !draft.trim() ? 0.5 : 1 }}
          >
            <Ionicons name="send" size={18} color="#1C1C1E" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={historyOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setHistoryOpen(false)}
      >
        <View className="flex-1">
          <Pressable className="flex-1 bg-black/40" onPress={() => setHistoryOpen(false)} />
          <View
            style={{ maxHeight: "70%" }}
            className="rounded-t-2xl border-t border-border bg-card p-4 dark:border-border-dark dark:bg-card-dark"
          >
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-foreground dark:text-foreground-dark">
                Conversas
              </Text>
              <Pressable onPress={startNew} className="flex-row items-center gap-1.5">
                <Ionicons name="create-outline" size={18} color={colors.primary} />
                <Text className="text-sm font-medium text-primary dark:text-primary-dark">
                  Nova
                </Text>
              </Pressable>
            </View>

            {conversations.length === 0 ? (
              <Text className="py-8 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
                Nenhuma conversa ainda.
              </Text>
            ) : (
              <ScrollView>
                {conversations.map((conversation) => (
                  <View
                    key={conversation.id}
                    className="flex-row items-center gap-3 border-b border-border/60 py-3 dark:border-border-dark"
                  >
                    <Pressable className="flex-1" onPress={() => openConversation(conversation.id)}>
                      <Text
                        numberOfLines={1}
                        className={`text-sm ${
                          conversation.id === conversationId
                            ? "font-semibold text-foreground dark:text-foreground-dark"
                            : "text-foreground dark:text-foreground-dark"
                        }`}
                      >
                        {conversation.agent?.icon ? `${conversation.agent.icon} ` : ""}
                        {conversation.title}
                      </Text>
                      <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                        {formatDate(conversation.lastMessageAt)}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDeleteConversation(conversation)}
                      accessibilityLabel={`Excluir ${conversation.title}`}
                    >
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
