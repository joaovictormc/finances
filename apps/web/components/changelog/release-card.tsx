import {
  CHANGELOG_PLATFORM_LABELS,
  type ChangelogItemKind,
  type PublishedChangelogRelease,
} from "@finances/validations";
import { formatDate } from "@/lib/utils";

const SECTIONS: { kind: ChangelogItemKind; heading: string }[] = [
  { kind: "new", heading: "Novidades" },
  { kind: "improvement", heading: "Melhorias" },
  { kind: "fix", heading: "Correções" },
];

/** Uma novidade publicada: versão, data e itens agrupados por tipo. */
export function ReleaseCard({ release, compact = false }: { release: PublishedChangelogRelease; compact?: boolean }) {
  return (
    <article>
      <p className="font-mono text-xs text-muted-foreground">
        Versão {release.version} · {formatDate(release.publishedAt)}
        {release.platforms.length > 0 && ` · ${release.platforms.map((p) => CHANGELOG_PLATFORM_LABELS[p]).join(", ")}`}
      </p>
      <h3 className={compact ? "mt-1 text-sm font-semibold text-foreground" : "mt-1 text-base font-semibold text-foreground"}>
        {release.title}
      </h3>
      <div className="mt-3 space-y-3">
        {SECTIONS.map(({ kind, heading }) => {
          const items = release.items.filter((item) => item.kind === kind);
          if (items.length === 0) return null;
          return (
            <div key={kind}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
                {items.map((item, index) => (
                  <li key={index}>{item.text}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </article>
  );
}
