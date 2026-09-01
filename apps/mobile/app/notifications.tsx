import { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";
import { routeForNotification } from "@/lib/notification-links";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  insight_ready: "bulb-outline",
  budget_alert: "pie-chart-outline",
  overdraft_warning: "warning-outline",
  bill_reminder: "receipt-outline",
  goal_milestone: "trophy-outline",
  group_activity: "people-outline",
  referral_reward: "gift-outline",
  pix_checkout_pending: "card-outline",
};

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

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ items: Notification[]; unread: number }>("/api/notifications");
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // Lista vazia com o aviso de erro seria pior que manter o que já está na
      // tela; o pull-to-refresh dá a segunda chance.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function markRead(id: string) {
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

  async function markAll() {
    setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnread(0);
    try {
      await api.post("/api/notifications/read-all", {});
    } catch {
      void load();
    }
  }

  function clearAll() {
    Alert.alert(
      "Limpar notificações",
      `Isso apaga as ${items.length} notificações da sua lista, inclusive as não lidas. Não dá pra desfazer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpar tudo",
          style: "destructive",
          onPress: async () => {
            setItems([]);
            setUnread(0);
            try {
              await api.delete<{ count: number }>("/api/notifications");
            } catch {
              void load();
            }
          },
        },
      ]
    );
  }

  function open(item: Notification) {
    if (!item.readAt) void markRead(item.id);
    const link = routeForNotification(item);
    if (link) router.push(link as never);
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      {items.length > 0 && (
        <View className="flex-row justify-end gap-2 p-4">
          {unread > 0 && (
            <Pressable
              onPress={markAll}
              className="flex-row items-center gap-1 rounded-full border border-border px-3 py-2 dark:border-border-dark"
            >
              <Ionicons name="checkmark-done-outline" size={16} color={colors.foreground} />
              <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">
                Marcar todas
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={clearAll}
            accessibilityLabel="Limpar todas as notificações"
            className="flex-row items-center gap-1 rounded-full border border-border px-3 py-2 dark:border-border-dark"
          >
            <Ionicons name="trash-outline" size={16} color={colors.destructive} />
            <Text className="text-sm font-medium text-destructive">Limpar</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: items.length > 0 ? 0 : 16, gap: 10 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View className="items-center gap-2 p-8">
            <Ionicons name="notifications-off-outline" size={32} color={colors.mutedForeground} />
            <Text className="text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
              Nenhuma notificação por aqui.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const hasLink = routeForNotification(item) !== null;
          return (
            <Pressable
              onPress={() => open(item)}
              className={`flex-row items-start gap-3 rounded-xl border p-4 ${
                item.readAt
                  ? "border-border bg-card dark:border-border-dark dark:bg-card-dark"
                  : "border-primary/40 bg-primary/5"
              }`}
            >
              <View className="mt-0.5">
                <Ionicons
                  name={ICONS[item.type] ?? "notifications-outline"}
                  size={18}
                  color={item.readAt ? colors.mutedForeground : colors.primary}
                />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text
                    className="flex-1 text-sm font-semibold text-foreground dark:text-foreground-dark"
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  {hasLink && (
                    <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                  )}
                </View>
                <Text className="mt-0.5 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                  {item.body}
                </Text>
                <Text className="mt-1 text-[11px] text-muted-foreground dark:text-muted-foreground-dark">
                  {relativeTime(item.createdAt)}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
