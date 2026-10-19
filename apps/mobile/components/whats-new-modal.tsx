import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import type { PublishedChangelogRelease } from "@finances/validations";
import { api } from "@/lib/api-client";
import { CHANGELOG_PLATFORM } from "@/lib/changelog";
import { ReleaseCard } from "@/components/release-card";

/**
 * "O que há de novo": aparece uma vez, na primeira abertura depois de uma
 * novidade publicada. Fechar marca como visto, e a mesma novidade não volta;
 * o histórico fica na tela Novidades.
 */
export function WhatsNewModal() {
  const [releases, setReleases] = useState<PublishedChangelogRelease[]>([]);

  useEffect(() => {
    let active = true;
    api
      .get<PublishedChangelogRelease[]>("/api/changelog/unseen", { platform: CHANGELOG_PLATFORM })
      .then((list) => {
        if (active) setReleases(list);
      })
      .catch(() => {
        // Sem conexão: tenta de novo na próxima abertura.
      });
    return () => {
      active = false;
    };
  }, []);

  function close(then?: () => void) {
    setReleases([]);
    void api.post("/api/changelog/seen", {}).catch(() => {});
    then?.();
  }

  return (
    <Modal visible={releases.length > 0} transparent animationType="fade" onRequestClose={() => close()}>
      <View className="flex-1 items-center justify-center bg-black/50 p-5">
        <View
          className="w-full rounded-2xl border border-border bg-card dark:border-border-dark dark:bg-card-dark"
          style={{ maxHeight: "80%" }}
        >
          <Text className="px-5 pt-5 text-lg font-semibold text-foreground dark:text-foreground-dark">
            O que há de novo
          </Text>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
            {releases.map((release) => (
              <ReleaseCard key={release.id} release={release} />
            ))}
          </ScrollView>
          <View className="flex-row items-center justify-between gap-3 border-t border-border px-5 py-4 dark:border-border-dark">
            <Pressable onPress={() => close(() => router.push("/changelog"))}>
              <Text className="text-sm text-muted-foreground underline dark:text-muted-foreground-dark">Ver todas</Text>
            </Pressable>
            <Pressable onPress={() => close()} className="rounded-md bg-primary px-5 py-2.5 dark:bg-primary-dark">
              <Text className="font-semibold text-primary-foreground dark:text-primary-foreground-dark">Entendi</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
