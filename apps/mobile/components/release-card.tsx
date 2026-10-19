import { View, Text } from "react-native";
import {
  CHANGELOG_PLATFORM_LABELS,
  type ChangelogItemKind,
  type PublishedChangelogRelease,
} from "@finances/validations";
import { formatDate } from "@/lib/format";

const SECTIONS: { kind: ChangelogItemKind; heading: string }[] = [
  { kind: "new", heading: "Novidades" },
  { kind: "improvement", heading: "Melhorias" },
  { kind: "fix", heading: "Correções" },
];

/** Uma novidade publicada: versão, data e itens agrupados por tipo. */
export function ReleaseCard({ release }: { release: PublishedChangelogRelease }) {
  return (
    <View>
      <Text className="font-mono text-xs text-muted-foreground dark:text-muted-foreground-dark">
        Versão {release.version} · {formatDate(release.publishedAt)}
        {release.platforms.length > 0 && ` · ${release.platforms.map((p) => CHANGELOG_PLATFORM_LABELS[p]).join(", ")}`}
      </Text>
      <Text className="mt-1 text-base font-semibold text-foreground dark:text-foreground-dark">{release.title}</Text>
      {SECTIONS.map(({ kind, heading }) => {
        const items = release.items.filter((item) => item.kind === kind);
        if (items.length === 0) return null;
        return (
          <View key={kind} className="mt-3">
            <Text className="text-xs font-semibold uppercase text-muted-foreground dark:text-muted-foreground-dark">
              {heading}
            </Text>
            {items.map((item, index) => (
              <View key={index} className="mt-1 flex-row gap-2">
                <Text className="text-sm text-foreground dark:text-foreground-dark">•</Text>
                <Text className="flex-1 text-sm text-foreground dark:text-foreground-dark">{item.text}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
