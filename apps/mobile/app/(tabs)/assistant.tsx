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
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api-client";
import { Screen } from "@/components/screen";
import { useTheme } from "@/lib/theme";
import type { Subscription } from "@/lib/types";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: string[] | null;
};

type Conversation = { id: string; title: string; agentId: string | null };

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

  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      api
        .get<Subscription>("/api/billing/subscription")
        .then((sub) => setAllowed(sub.plan !== "free" || Boolean(sub.hasIntegrationsModule)))
        .catch(() => setAllowed(false));
    }, [])
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
        });
        id = created.id;
        setConversationId(created.id);
      }

      const answer = await api.post<Message>(`/api/assistant/conversations/${id}/messages`, {
        content,
      });
      setMessages((prev) => [...prev, answer]);
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
    setError(null);
  }

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
          <Pressable onPress={() => router.push("/assistant-agents")} accessibilityLabel="Agentes">
            <Ionicons name="construct-outline" size={22} color={colors.mutedForeground} />
          </Pressable>
          <Pressable onPress={startNew} accessibilityLabel="Nova conversa">
            <Ionicons name="create-outline" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

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
          {messages.length === 0 && !sending ? (
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
                    Consultei: {message.toolCalls.join(", ")}
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
    </Screen>
  );
}
