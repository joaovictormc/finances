import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, Alert, Share } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import { useTheme } from "@/lib/theme";
import type { GroupDetail, GroupRole } from "@/lib/types";

type LeaderboardEntry = { userId: string; name: string; points: number; level: number; activeBadge: string | null };

// Mesmos ícones do catálogo em apps/api/src/lib/gamification.ts (BADGE_CATALOG).
const BADGE_ICONS: Record<string, string> = {
  poupador: "🐷",
  disciplinado: "🔥",
  estrategista: "🧠",
  lenda: "👑",
};

const ROLE_LABELS: Record<GroupRole, string> = {
  owner: "Dono",
  admin: "Admin",
  member: "Membro",
  viewer: "Visualizador",
};

export default function GroupDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: session } = useSession();
  const myUserId = session?.user?.id;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<GroupDetail>(`/api/groups/${id}`)
      .then((g) => {
        setGroup(g);
        setName(g.name);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar grupo."))
      .finally(() => setLoading(false));
    api
      .get<LeaderboardEntry[]>(`/api/groups/${id}/leaderboard`)
      .then(setLeaderboard)
      .catch(() => setLeaderboard([]));
  }, [id]);

  useFocusEffect(load);

  const canManage = group?.role === "owner" || group?.role === "admin";
  const isOwner = group?.role === "owner";

  async function handleRename() {
    if (!group || !name.trim() || name.trim() === group.name) return;
    setSavingName(true);
    try {
      await api.patch(`/api/groups/${group.id}`, { name: name.trim() });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao renomear grupo.");
    } finally {
      setSavingName(false);
    }
  }

  async function handleShare() {
    if (!group) return;
    await Share.share({
      message: `Entra no meu grupo "${group.name}" no ControlAI! Código de convite: ${group.inviteCode}`,
    });
  }

  function confirmRemoveMember(memberUserId: string, memberName: string) {
    if (!group) return;
    const isSelf = memberUserId === myUserId;
    Alert.alert(
      isSelf ? "Sair do grupo" : "Remover membro",
      isSelf ? `Tem certeza que deseja sair de "${group.name}"?` : `Remover ${memberName} do grupo?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: isSelf ? "Sair" : "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/api/groups/${group.id}/members/${memberUserId}`);
              if (isSelf) router.back();
              else load();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Erro ao remover membro.");
            }
          },
        },
      ]
    );
  }

  function confirmDeleteGroup() {
    if (!group) return;
    Alert.alert("Excluir grupo", `Excluir "${group.name}"? Essa ação não pode ser desfeita.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/api/groups/${group.id}`);
            router.back();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao excluir grupo.");
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!group) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6 dark:bg-background-dark">
        <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
          {error ?? "Grupo não encontrado."}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerStyle={{ padding: 16, gap: 16 }}
      data={group.members}
      keyExtractor={(m) => m.userId}
      ListHeaderComponent={
        <View className="gap-4">
          <View>
            <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Nome do grupo</Text>
            <TextInput
              className="rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
              value={name}
              onChangeText={setName}
              editable={canManage}
              onBlur={handleRename}
            />
            {savingName && <ActivityIndicator size="small" color={colors.primary} className="mt-2" />}
          </View>

          {canManage && (
            <Pressable
              onPress={handleShare}
              className="flex-row items-center justify-center gap-2 rounded-md border border-primary py-3 dark:border-primary-dark"
            >
              <Ionicons name="share-social-outline" size={18} color={colors.primary} />
              <Text className="text-sm font-medium text-primary dark:text-primary-dark">
                Compartilhar código: {group.inviteCode}
              </Text>
            </Pressable>
          )}

          {error && <Text className="text-sm text-destructive dark:text-destructive-dark">{error}</Text>}

          {leaderboard.length > 0 && (
            <View className="gap-2 rounded-xl border border-border bg-card p-4 dark:border-border-dark dark:bg-card-dark">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="trophy-outline" size={16} color={colors.mutedForeground} />
                <Text className="text-sm font-semibold text-foreground dark:text-foreground-dark">Ranking de pontos</Text>
              </View>
              {leaderboard.map((entry, i) => (
                <View key={entry.userId} className="flex-row items-center gap-3 border-t border-border py-2 dark:border-border-dark">
                  <Text className="w-5 text-center text-xs font-semibold text-muted-foreground dark:text-muted-foreground-dark">
                    {i + 1}º
                  </Text>
                  <View className="flex-1">
                    <Text className="flex-row text-sm font-medium text-foreground dark:text-foreground-dark">
                      {entry.activeBadge ? `${BADGE_ICONS[entry.activeBadge] ?? ""} ` : ""}
                      {entry.name}
                    </Text>
                    <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">Nível {entry.level}</Text>
                  </View>
                  <Text className="text-sm font-semibold text-foreground dark:text-foreground-dark">{entry.points} pts</Text>
                </View>
              ))}
            </View>
          )}

          <Text className="text-sm font-medium text-muted-foreground dark:text-muted-foreground-dark">
            Membros ({group.members.length})
          </Text>
        </View>
      }
      renderItem={({ item: m }) => (
        <View className="flex-row items-center justify-between rounded-xl border border-border bg-card p-4 dark:border-border-dark dark:bg-card-dark">
          <View className="flex-1">
            <Text className="font-semibold text-foreground dark:text-foreground-dark">{m.name}</Text>
            <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
              {m.email} · {ROLE_LABELS[m.role]}
            </Text>
          </View>
          {m.role !== "owner" && (m.userId === myUserId || canManage) && (
            <Pressable onPress={() => confirmRemoveMember(m.userId, m.name)} hitSlop={8}>
              <Ionicons
                name={m.userId === myUserId ? "exit-outline" : "person-remove-outline"}
                size={20}
                color="#ef4444"
              />
            </Pressable>
          )}
        </View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      ListFooterComponent={
        isOwner ? (
          <Pressable
            onPress={confirmDeleteGroup}
            className="mt-4 items-center rounded-md border border-destructive py-3 dark:border-destructive-dark"
          >
            <Text className="text-sm font-medium text-destructive dark:text-destructive-dark">Excluir grupo</Text>
          </Pressable>
        ) : null
      }
    />
  );
}
