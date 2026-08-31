import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";

type Agent = {
  id: string;
  name: string;
  icon: string | null;
  instructions: string;
  enabledTools: string[];
};

type Tool = { name: string; label: string };

type Preset = {
  slug: string;
  name: string;
  icon: string;
  description: string;
  instructions: string;
  enabledTools: string[];
};

type Draft = {
  id?: string;
  name: string;
  icon: string;
  instructions: string;
  enabledTools: string[];
};

const EMPTY_DRAFT: Draft = { name: "", icon: "", instructions: "", enabledTools: [] };

export default function AssistantAgentsScreen() {
  const { colors } = useTheme();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [ags, tls, pre] = await Promise.all([
        api.get<Agent[]>("/api/assistant/agents"),
        api.get<Tool[]>("/api/assistant/tools"),
        api.get<Preset[]>("/api/assistant/presets"),
      ]);
      setAgents(ags);
      setTools(tls);
      setPresets(pre);
    } catch {
      setError("Erro ao carregar os agentes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleTool(name: string) {
    if (!draft) return;
    const enabled = draft.enabledTools.includes(name)
      ? draft.enabledTools.filter((t) => t !== name)
      : [...draft.enabledTools, name];
    setDraft({ ...draft, enabledTools: enabled });
  }

  async function handleSave() {
    if (!draft || !draft.name.trim() || !draft.instructions.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: draft.name.trim(),
        icon: draft.icon.trim() || undefined,
        instructions: draft.instructions.trim(),
        enabledTools: draft.enabledTools,
      };
      if (draft.id) {
        await api.patch(`/api/assistant/agents/${draft.id}`, payload);
      } else {
        await api.post("/api/assistant/agents", payload);
      }
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(agent: Agent) {
    Alert.alert(
      `Excluir ${agent.name}`,
      "As conversas desse agente continuam salvas, mas ficam sem agente.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/api/assistant/agents/${agent.id}`);
              await load();
            } catch {
              setError("Erro ao excluir.");
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerStyle={{ padding: 16 }}
    >
      {error && (
        <Text className="mb-3 text-sm text-destructive dark:text-destructive-dark">{error}</Text>
      )}

      {draft ? (
        <View className="gap-4">
          <View className="flex-row gap-2">
            <View className="w-20">
              <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">
                Ícone
              </Text>
              <TextInput
                className="rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
                placeholder="💰"
                placeholderTextColor={colors.mutedForeground}
                maxLength={8}
                value={draft.icon}
                onChangeText={(v) => setDraft({ ...draft, icon: v })}
              />
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">
                Nome
              </Text>
              <TextInput
                className="rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
                placeholder="Ex: Coach de economia"
                placeholderTextColor={colors.mutedForeground}
                maxLength={60}
                value={draft.name}
                onChangeText={(v) => setDraft({ ...draft, name: v })}
              />
            </View>
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">
              Instruções
            </Text>
            <TextInput
              className="rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
              placeholder="Ex: Foque em achar gastos supérfluos e sugerir onde cortar."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
              maxLength={2000}
              textAlignVertical="top"
              value={draft.instructions}
              onChangeText={(v) => setDraft({ ...draft, instructions: v })}
            />
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">
              Dados que ele pode consultar
            </Text>
            <Text className="mb-2 text-xs text-muted-foreground dark:text-muted-foreground-dark">
              Nenhum marcado = acesso a tudo. Marcando alguns, o agente recusa perguntas fora
              desse escopo em vez de responder com o dado errado.
            </Text>
            {tools.map((tool) => {
              const checked = draft.enabledTools.includes(tool.name);
              return (
                <Pressable
                  key={tool.name}
                  onPress={() => toggleTool(tool.name)}
                  className="flex-row items-center gap-2 py-2"
                >
                  <Ionicons
                    name={checked ? "checkbox" : "square-outline"}
                    size={20}
                    color={checked ? colors.primary : colors.mutedForeground}
                  />
                  <Text className="text-sm text-foreground dark:text-foreground-dark">
                    {tool.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={handleSave}
            disabled={saving || !draft.name.trim() || !draft.instructions.trim()}
            className="items-center rounded-md bg-primary py-3 dark:bg-primary-dark"
            style={{ opacity: saving || !draft.name.trim() || !draft.instructions.trim() ? 0.5 : 1 }}
          >
            {saving ? (
              <ActivityIndicator color="#1C1C1E" />
            ) : (
              <Text className="font-medium text-primary-foreground dark:text-primary-foreground-dark">
                Salvar
              </Text>
            )}
          </Pressable>
          <Pressable onPress={() => setDraft(null)} className="items-center py-2">
            <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
              Cancelar
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="gap-3">
          {agents.length === 0 ? (
            <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
              Nenhum agente ainda. Crie um para conversar sobre um assunto específico com um
              recorte próprio dos seus dados.
            </Text>
          ) : (
            agents.map((agent) => (
              <View
                key={agent.id}
                className="flex-row items-center gap-3 rounded-2xl border border-border bg-card p-4 dark:border-border-dark dark:bg-card-dark"
              >
                <Text className="text-lg">{agent.icon || "🤖"}</Text>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">
                    {agent.name}
                  </Text>
                  <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                    {agent.enabledTools.length === 0
                      ? "Todas as ferramentas"
                      : `${agent.enabledTools.length} de ${tools.length} ferramentas`}
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    setDraft({
                      id: agent.id,
                      name: agent.name,
                      icon: agent.icon ?? "",
                      instructions: agent.instructions,
                      enabledTools: agent.enabledTools,
                    })
                  }
                  accessibilityLabel={`Editar ${agent.name}`}
                >
                  <Ionicons name="pencil-outline" size={18} color={colors.mutedForeground} />
                </Pressable>
                <Pressable
                  onPress={() => confirmDelete(agent)}
                  accessibilityLabel={`Excluir ${agent.name}`}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </Pressable>
              </View>
            ))
          )}

          <Pressable
            onPress={() => setDraft({ ...EMPTY_DRAFT })}
            className="mt-2 flex-row items-center justify-center gap-2 rounded-md bg-primary py-3 dark:bg-primary-dark"
          >
            <Ionicons name="add" size={18} color="#1C1C1E" />
            <Text className="font-medium text-primary-foreground dark:text-primary-foreground-dark">
              Novo agente
            </Text>
          </Pressable>

          {/* Presets abrem o formulário preenchido em vez de criar direto: o
              usuário vê o que vai ser criado e pode ajustar antes de salvar. */}
          {presets.length > 0 && (
            <View className="mt-4 gap-2">
              <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">
                Modelos prontos
              </Text>
              <Text className="mb-1 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                Começam preenchidos; você pode editar tudo antes de salvar.
              </Text>
              {presets.map((preset) => (
                <Pressable
                  key={preset.slug}
                  onPress={() =>
                    setDraft({
                      name: preset.name,
                      icon: preset.icon,
                      instructions: preset.instructions,
                      enabledTools: preset.enabledTools,
                    })
                  }
                  className="flex-row items-center gap-3 rounded-2xl border border-border bg-card p-4 dark:border-border-dark dark:bg-card-dark"
                >
                  <Text className="text-lg">{preset.icon}</Text>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">
                      {preset.name}
                    </Text>
                    <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
                      {preset.description}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
