import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";
import type { Category } from "@/lib/types";

/**
 * Chip "+ Nova" no fim da lista de categorias: abre um formulário curto ali
 * mesmo e devolve a categoria criada (já como categoria principal) pra tela
 * selecionar. Subcategoria e edição ficam na web, em Configurações.
 */
export function NewCategoryChip({
  type,
  onCreated,
}: {
  type: "income" | "expense";
  onCreated: (category: Category) => void;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setName("");
    setIcon("");
    setError(null);
  }

  async function create() {
    if (!name.trim()) {
      setError("Informe o nome da categoria.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const category = await api.post<Category>("/api/categories", {
        name: name.trim(),
        type,
        icon: icon.trim() || null,
      });
      onCreated({ ...category, children: [] });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar categoria.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        className="rounded-full border border-dashed border-border px-3 py-1.5 dark:border-border-dark"
      >
        <Text className="text-xs font-medium text-muted-foreground dark:text-muted-foreground-dark">+ Nova</Text>
      </Pressable>
    );
  }

  return (
    <View className="w-full gap-2 rounded-lg border border-border bg-card p-3 dark:border-border-dark dark:bg-card-dark">
      <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">Nova categoria</Text>
      <View className="flex-row gap-2">
        <TextInput
          className="w-14 rounded-md border border-border bg-card px-2 py-2 text-center text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
          placeholder="🏷️"
          placeholderTextColor={colors.mutedForeground}
          maxLength={16}
          value={icon}
          onChangeText={setIcon}
          accessibilityLabel="Ícone (emoji)"
        />
        <TextInput
          className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
          placeholder="Nome (ex.: Pets)"
          placeholderTextColor={colors.mutedForeground}
          maxLength={40}
          value={name}
          onChangeText={setName}
          onSubmitEditing={() => void create()}
          returnKeyType="done"
          autoFocus
          accessibilityLabel="Nome da categoria"
        />
      </View>
      {error && <Text className="text-xs text-destructive">{error}</Text>}
      <View className="flex-row justify-end gap-2">
        <Pressable onPress={close} className="rounded-md border border-border px-3 py-2 dark:border-border-dark">
          <Text className="text-xs font-medium text-foreground dark:text-foreground-dark">Cancelar</Text>
        </Pressable>
        <Pressable
          onPress={() => void create()}
          disabled={saving}
          className="flex-row items-center gap-1 rounded-md bg-primary px-3 py-2"
          style={{ opacity: saving ? 0.6 : 1 }}
        >
          {saving && <ActivityIndicator size="small" color="#1C1C1E" />}
          <Text className="text-xs font-medium text-primary-foreground dark:text-primary-foreground-dark">Criar</Text>
        </Pressable>
      </View>
    </View>
  );
}
