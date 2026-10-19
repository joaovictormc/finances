import { z } from "zod";

/** Tipo de cada item de uma novidade. */
export const CHANGELOG_ITEM_KINDS = ["new", "improvement", "fix"] as const;
export type ChangelogItemKind = (typeof CHANGELOG_ITEM_KINDS)[number];

export const CHANGELOG_KIND_LABELS: Record<ChangelogItemKind, string> = {
  new: "Novidade",
  improvement: "Melhoria",
  fix: "Correção",
};

/** Onde a mudança aparece. Nenhuma marcada = vale para todas. */
export const CHANGELOG_PLATFORMS = ["web", "android", "ios"] as const;
export type ChangelogPlatform = (typeof CHANGELOG_PLATFORMS)[number];

export const CHANGELOG_PLATFORM_LABELS: Record<ChangelogPlatform, string> = {
  web: "Web",
  android: "Android",
  ios: "iPhone",
};

export const ChangelogItemSchema = z.object({
  kind: z.enum(CHANGELOG_ITEM_KINDS),
  text: z.string().trim().min(3, "Descreva o item").max(300),
});
export type ChangelogItem = z.infer<typeof ChangelogItemSchema>;

export const ChangelogReleaseInputSchema = z.object({
  version: z.string().trim().min(1, "Informe a versão").max(30),
  title: z.string().trim().min(3, "Dê um título").max(120),
  items: z.array(ChangelogItemSchema).min(1, "Inclua pelo menos um item").max(30),
  platforms: z.array(z.enum(CHANGELOG_PLATFORMS)).max(3).default([]),
});
export type ChangelogReleaseInput = z.infer<typeof ChangelogReleaseInputSchema>;

export const ChangelogPublishSchema = z.object({
  /** Aviso no sininho do app (web e mobile). */
  notifyInApp: z.boolean().default(true),
  /** E-mail para quem não desligou os avisos por e-mail. */
  notifyEmail: z.boolean().default(false),
});
export type ChangelogPublishInput = z.infer<typeof ChangelogPublishSchema>;

/** Novidade publicada, como as telas recebem. */
export type PublishedChangelogRelease = {
  id: string;
  version: string;
  title: string;
  items: ChangelogItem[];
  platforms: ChangelogPlatform[];
  publishedAt: string;
};
