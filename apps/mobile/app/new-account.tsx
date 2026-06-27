import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";
import type { Group } from "@/lib/types";

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "checking", label: "Conta Corrente" },
  { value: "savings", label: "Poupança" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "investment", label: "Investimento" },
  { value: "wallet", label: "Carteira" },
];

export default function NewAccountScreen() {
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [type, setType] = useState("checking");
  const [institution, setInstitution] = useState("");
  const [groupId, setGroupId] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Group[]>("/api/groups").then(setGroups).catch(() => {});
  }, []);

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError("Informe o nome da conta.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/api/accounts", {
        name: name.trim(),
        type,
        institution: institution.trim() || undefined,
        groupId: groupId || undefined,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar conta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark" contentContainerStyle={{ padding: 16 }}>
      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Nome</Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="Ex: Nubank, Itaú Corrente"
        placeholderTextColor={colors.mutedForeground}
        value={name}
        onChangeText={setName}
      />

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Tipo</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {TYPE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => setType(opt.value)}
            className={`rounded-full border px-3 py-1.5 ${type === opt.value ? "border-primary bg-primary/10 dark:border-primary-dark" : "border-border dark:border-border-dark"}`}
          >
            <Text className="text-xs font-medium text-foreground dark:text-foreground-dark">{opt.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Instituição (opcional)</Text>
      <TextInput
        className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="Ex: Nubank, Itaú, Bradesco"
        placeholderTextColor={colors.mutedForeground}
        value={institution}
        onChangeText={setInstitution}
      />

      {groups.length > 0 && (
        <>
          <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Compartilhar com</Text>
          <View className="mb-4 flex-row flex-wrap gap-2">
            <Pressable
              onPress={() => setGroupId("")}
              className={`rounded-full border px-3 py-1.5 ${!groupId ? "border-primary bg-primary/10 dark:border-primary-dark" : "border-border dark:border-border-dark"}`}
            >
              <Text className="text-xs font-medium text-foreground dark:text-foreground-dark">Pessoal</Text>
            </Pressable>
            {groups.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => setGroupId(g.id)}
                className={`rounded-full border px-3 py-1.5 ${groupId === g.id ? "border-primary bg-primary/10 dark:border-primary-dark" : "border-border dark:border-border-dark"}`}
              >
                <Text className="text-xs font-medium text-foreground dark:text-foreground-dark">{g.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {error && <Text className="mb-3 text-sm text-destructive dark:text-destructive-dark">{error}</Text>}

      <Pressable
        onPress={handleSubmit}
        disabled={saving}
        className="items-center rounded-md bg-primary py-3 dark:bg-primary-dark"
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-medium text-primary-foreground dark:text-primary-foreground-dark">Salvar</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
