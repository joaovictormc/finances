import { useMemo, useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { NewCategoryChip } from "@/components/new-category-chip";
import type { Category } from "@/lib/types";

type Row = { id: string; label: string; icon: string | null; parent: string | null };

/** Sem acento e em minúsculas: "alimentação" acha "Alimentacao" e vice-versa. */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Principais seguidas das suas subcategorias, na ordem em que a API devolve. */
function toRows(categories: Category[]): Row[] {
  return categories.flatMap((c) => [
    { id: c.id, label: c.name, icon: c.icon, parent: null },
    ...(c.children ?? []).map((child) => ({ id: child.id, label: child.name, icon: child.icon, parent: c.name })),
  ]);
}

/**
 * Campo de categoria: mostra a escolhida e abre uma lista com busca. Substitui
 * os chips soltos, que viravam uma parede de botões com muitas categorias.
 */
export function CategoryPicker({
  label,
  categories,
  value,
  onChange,
  emptyLabel,
  createType,
  onCreated,
}: {
  label: string;
  categories: Category[];
  /** Id escolhido; vazio/undefined = a opção "emptyLabel". */
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  /** Opção de não escolher (ex.: "Sem categoria", "Geral"). */
  emptyLabel: string;
  /** Com tipo, a lista oferece criar uma categoria nova desse tipo. */
  createType?: "income" | "expense";
  onCreated?: (category: Category) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => toRows(categories), [categories]);
  const selected = rows.find((row) => row.id === value);
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return rows;
    return rows.filter((row) => normalize(row.label).includes(q) || (row.parent && normalize(row.parent).includes(q)));
  }, [rows, query]);
  const searching = query.trim().length > 0;

  function close() {
    setOpen(false);
    setQuery("");
  }

  function pick(id: string | undefined) {
    onChange(id);
    close();
  }

  return (
    <>
      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected ? selected.label : emptyLabel}. Toque para escolher.`}
        className="mb-4 flex-row items-center gap-2 rounded-md border border-border bg-card px-3 py-3 dark:border-border-dark dark:bg-card-dark"
      >
        <Text className="flex-1 text-foreground dark:text-foreground-dark" numberOfLines={1}>
          {selected ? `${selected.icon ? `${selected.icon} ` : ""}${selected.parent ? `${selected.parent} › ` : ""}${selected.label}` : emptyLabel}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable className="flex-1 bg-black/40" onPress={close} accessibilityLabel="Fechar" />
        <KeyboardAvoidingView
          // padding nos dois: no Android edge-to-edge a janela não encolhe com o teclado.
          behavior="padding"
          className="absolute inset-x-0 bottom-0"
          style={{ maxHeight: "85%" }}
        >
          <View
            className="rounded-t-2xl border-t border-border bg-card dark:border-border-dark dark:bg-card-dark"
            style={{ paddingBottom: insets.bottom }}
          >
            <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
              <Text className="text-base font-semibold text-foreground dark:text-foreground-dark">{label}</Text>
              <Pressable onPress={close} hitSlop={12} accessibilityLabel="Fechar">
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <View className="mx-4 mb-2 flex-row items-center gap-2 rounded-md border border-border bg-background px-3 dark:border-border-dark dark:bg-background-dark">
              <Ionicons name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar categoria"
                placeholderTextColor={colors.mutedForeground}
                className="flex-1 py-2.5 text-foreground dark:text-foreground-dark"
                autoCorrect={false}
                returnKeyType="search"
              />
              {searching && (
                <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityLabel="Limpar busca">
                  <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(row) => row.id}
              keyboardShouldPersistTaps="handled"
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 12 }}
              ListHeaderComponent={
                searching ? null : (
                  <OptionRow label={emptyLabel} active={!value} onPress={() => pick(undefined)} muted />
                )
              }
              renderItem={({ item }) => (
                <OptionRow
                  label={searching && item.parent ? `${item.parent} › ${item.label}` : item.label}
                  icon={item.icon}
                  indent={!searching && !!item.parent}
                  active={item.id === value}
                  onPress={() => pick(item.id)}
                />
              )}
              ListEmptyComponent={
                <Text className="px-3 py-6 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
                  Nenhuma categoria com &quot;{query.trim()}&quot;.
                </Text>
              }
              ListFooterComponent={
                createType && onCreated ? (
                  <View className="flex-row flex-wrap px-2 pt-2">
                    <NewCategoryChip
                      type={createType}
                      onCreated={(category) => {
                        onCreated(category);
                        pick(category.id);
                      }}
                    />
                  </View>
                ) : null
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function OptionRow({
  label,
  icon,
  active,
  indent,
  muted,
  onPress,
}: {
  label: string;
  icon?: string | null;
  active: boolean;
  indent?: boolean;
  muted?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`flex-row items-center gap-3 rounded-lg px-3 py-3 ${active ? "bg-primary/10" : ""}`}
      style={indent ? { paddingLeft: 32 } : undefined}
    >
      <Text className="w-6 text-center text-base">{icon ?? (indent ? "↳" : "")}</Text>
      <Text
        className={`flex-1 text-base ${muted ? "text-muted-foreground dark:text-muted-foreground-dark" : "text-foreground dark:text-foreground-dark"}`}
        numberOfLines={1}
      >
        {label}
      </Text>
      {active && <Ionicons name="checkmark" size={20} color={colors.primary} />}
    </Pressable>
  );
}
