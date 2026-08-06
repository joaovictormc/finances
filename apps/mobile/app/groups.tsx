import { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api-client";
import { IconBadge } from "@/components/icon-badge";
import { useTheme } from "@/lib/theme";
import type { Group, GroupRole } from "@/lib/types";

const ROLE_LABELS: Record<GroupRole, string> = {
  owner: "Dono",
  admin: "Admin",
  member: "Membro",
  viewer: "Visualizador",
};

export default function GroupsScreen() {
  const { colors } = useTheme();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      api
        .get<Group[]>("/api/groups")
        .then(setGroups)
        .finally(() => setLoading(false));
    }, [])
  );

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <View className="flex-row justify-end gap-2 p-4">
        <Pressable
          onPress={() => router.push("/join-group")}
          className="flex-row items-center gap-1 rounded-full border border-border px-3 py-2 dark:border-border-dark"
        >
          <Ionicons name="key-outline" size={16} color={colors.foreground} />
          <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">Entrar com código</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/new-group")}
          className="flex-row items-center gap-1 rounded-full bg-primary px-3 py-2"
        >
          <Ionicons name="add" size={16} color="#1C1C1E" />
          <Text className="text-sm font-semibold text-primary-foreground">Novo Grupo</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12 }}
          ListEmptyComponent={
            <Text className="p-6 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
              Nenhum grupo ainda. Crie um ou entre com um código de convite.
            </Text>
          }
          renderItem={({ item: g }) => (
            <Pressable
              onPress={() => router.push({ pathname: "/group-detail", params: { id: g.id } })}
              className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4 dark:border-border-dark dark:bg-card-dark"
            >
              <IconBadge icon="👥" />
              <View className="flex-1">
                <Text className="font-semibold text-foreground dark:text-foreground-dark">{g.name}</Text>
                <Text className="mt-0.5 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                  {g.role ? ROLE_LABELS[g.role] : ""}
                  {g.memberCount != null ? ` · ${g.memberCount} membro${g.memberCount === 1 ? "" : "s"}` : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
