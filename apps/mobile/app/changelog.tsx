import { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import type { PublishedChangelogRelease } from "@finances/validations";
import { api } from "@/lib/api-client";
import { useTheme } from "@/lib/theme";
import { CHANGELOG_PLATFORM } from "@/lib/changelog";
import { ReleaseCard } from "@/components/release-card";

export default function ChangelogScreen() {
  const { colors } = useTheme();
  const [releases, setReleases] = useState<PublishedChangelogRelease[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setReleases(await api.get<PublishedChangelogRelease[]>("/api/changelog", { platform: CHANGELOG_PLATFORM }));
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <ScrollView
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      {releases === null && !error ? (
        <ActivityIndicator className="mt-10" color={colors.primary} />
      ) : error ? (
        <Text className="mt-10 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
          Não foi possível carregar as novidades agora.
        </Text>
      ) : releases!.length === 0 ? (
        <Text className="mt-10 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
          Nenhuma novidade publicada ainda.
        </Text>
      ) : (
        releases!.map((release) => (
          <View
            key={release.id}
            className="rounded-2xl border border-border bg-card p-4 dark:border-border-dark dark:bg-card-dark"
          >
            <ReleaseCard release={release} />
          </View>
        ))
      )}
    </ScrollView>
  );
}
