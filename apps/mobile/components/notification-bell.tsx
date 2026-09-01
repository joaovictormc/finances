import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";

/**
 * Sino com o contador de não lidas; abre a central.
 *
 * Recarrega a cada foco de tela em vez de consultar em intervalo: no celular o
 * app fica suspenso em segundo plano, e quem avisa fora dele é o push.
 */
export function NotificationBell() {
  const { colors } = useTheme();
  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      api
        .get<{ unread: number }>("/api/notifications")
        .then((data) => setUnread(data.unread))
        .catch(() => setUnread(0));
    }, [])
  );

  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      accessibilityLabel={unread > 0 ? `Notificações, ${unread} não lidas` : "Notificações"}
      className="h-10 w-10 items-center justify-center rounded-full bg-card dark:bg-card-dark"
    >
      <Ionicons name="notifications-outline" size={20} color={colors.foreground} />
      {unread > 0 && (
        <View className="absolute right-1 top-1 h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1">
          <Text className="text-[10px] font-bold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
