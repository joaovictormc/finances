import { z } from "zod";

/**
 * Conteúdo editável da landing page (apps/landing), montado em blocos.
 *
 * Campos estruturados por tipo de bloco, nunca HTML livre: o visual fica no
 * código (mundo "Fechamento de Caixa") e o admin edita só texto e ordem —
 * sem risco de quebrar o layout ou injetar script.
 */

const line = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1, "Campo obrigatório").max(max);

/**
 * Destino de um botão ou link. Só formatos seguros: atalhos do app
 * ("signup", "login"), âncora ("#planos"), página da própria landing
 * ("/termos") ou endereço https. Nada de "javascript:".
 */
export const LandingHrefSchema = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) => v === "signup" || v === "login" || /^#[a-z0-9-]+$/.test(v) || /^\/[a-z0-9-/]*$/.test(v) || /^https:\/\/\S+$/.test(v),
    "Use signup, login, #ancora, /pagina ou um endereço https://"
  );

/** Âncora da seção (id no HTML), para links como "#planos". */
const anchor = z
  .string()
  .trim()
  .max(40)
  .regex(/^[a-z0-9-]*$/, "Só letras minúsculas, números e hífen")
  .optional();

export const HeroBlockSchema = z.object({
  title: required(120),
  subtitle: line(400),
  primaryLabel: required(40),
  secondaryLabel: line(40),
  secondaryHref: LandingHrefSchema.or(z.literal("")),
  note: line(160),
  summaryLabel: line(40),
  summaryValue: line(30),
  demoLabel: line(80),
  // Valores em "R$ 1.234,56" na resposta aparecem em mono automaticamente.
  exchanges: z
    .array(z.object({ question: required(90), answer: required(280) }))
    .min(1)
    .max(4),
});

export const LedgerBlockSchema = z.object({
  title: required(120),
  body: line(400),
  sheetTitle: line(60),
  period: line(30),
  rows: z
    .array(
      z.object({
        date: line(10),
        description: required(50),
        initials: line(3),
        name: line(30),
        role: line(30),
        amount: required(20),
        income: z.boolean(),
      })
    )
    .min(1)
    .max(10),
  totalLabel: required(40),
  totalAmount: required(20),
  totalMarker: line(20),
  footer: line(120),
  marginTitle: line(80),
  notes: z.array(z.object({ when: line(12), text: required(160) })).max(5),
});

export const RolesBlockSchema = z.object({
  title: required(120),
  body: line(400),
  note: line(300),
});

export const LANDING_ROW_VISUALS = ["receipt", "files", "habit", "none"] as const;

export const ProductRowsBlockSchema = z.object({
  title: required(120),
  rows: z
    .array(
      z.object({
        title: required(100),
        body: line(400),
        note: line(120),
        visual: z.enum(LANDING_ROW_VISUALS),
      })
    )
    .min(1)
    .max(6),
});

export const PricingBlockSchema = z.object({
  title: required(120),
  footnote: line(240),
});

export const FaqBlockSchema = z.object({
  title: required(120),
  items: z.array(z.object({ question: required(140), answer: required(800) })).min(1).max(12),
});

export const CtaBlockSchema = z.object({
  title: required(120),
  primaryLabel: required(40),
  primaryHref: LandingHrefSchema,
  secondaryLabel: line(40),
  secondaryHref: LandingHrefSchema.or(z.literal("")),
});

/**
 * Texto corrido (Termos, Privacidade, Sobre). Parágrafos separados por linha
 * em branco; linha começando com "## " vira subtítulo e com "- " vira item.
 */
export const TextBlockSchema = z.object({
  title: line(120),
  body: required(20000),
});

export const LANDING_ICONS = ["camera", "file", "calendar", "phone", "check", "users", "chart", "shield"] as const;

export const HighlightsBlockSchema = z.object({
  title: required(120),
  body: line(400),
  items: z
    .array(z.object({ icon: z.enum(LANDING_ICONS), title: required(80), text: line(240) }))
    .min(1)
    .max(8),
});

const section = <T extends string, S extends z.ZodTypeAny>(type: T, data: S) =>
  z.object({
    id: z.string().min(1).max(40),
    type: z.literal(type),
    anchor,
    hidden: z.boolean().default(false),
    data,
  });

export const LandingSectionSchema = z.discriminatedUnion("type", [
  section("hero", HeroBlockSchema),
  section("ledger", LedgerBlockSchema),
  section("roles", RolesBlockSchema),
  section("productRows", ProductRowsBlockSchema),
  section("pricing", PricingBlockSchema),
  section("faq", FaqBlockSchema),
  section("cta", CtaBlockSchema),
  section("text", TextBlockSchema),
  section("highlights", HighlightsBlockSchema),
]);

export const LandingSectionsSchema = z.array(LandingSectionSchema).max(30);

/** Página "inicio" é a raiz do site (/); as demais ficam em /<slug>. */
export const LANDING_HOME_SLUG = "inicio";

export const LandingSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífen (ex.: termos-de-uso)")
  .refine((s) => !["preview", "api", "_next", "icons"].includes(s), "Endereço reservado");

export const CreateLandingPageSchema = z.object({
  slug: LandingSlugSchema,
  title: required(80),
});

export const UpdateLandingPageSchema = z.object({
  slug: LandingSlugSchema.optional(),
  title: required(80).optional(),
  description: line(200).optional(),
  showInFooter: z.boolean().optional(),
  sections: LandingSectionsSchema.optional(),
});

export type LandingSection = z.infer<typeof LandingSectionSchema>;
export type LandingSectionType = LandingSection["type"];
export type LandingBlockData<T extends LandingSectionType> = Extract<LandingSection, { type: T }>["data"];
export type LandingHref = z.infer<typeof LandingHrefSchema>;

/** Página publicada, como a landing recebe da API pública. */
export type PublishedLandingPage = {
  slug: string;
  title: string;
  description: string;
  sections: LandingSection[];
  publishedAt: string | null;
};

export type LandingFooterLink = { slug: string; title: string };

/**
 * Menu do site: itens do cabeçalho (e da coluna de seções do rodapé) em todas
 * as páginas. "#ancora" aponta para a seção da página inicial; "/pagina" para
 * uma página criada no editor.
 */
export const LandingMenuItemSchema = z.object({
  label: required(30),
  href: LandingHrefSchema,
});

export const LandingMenuSchema = z.array(LandingMenuItemSchema).max(6);

export type LandingMenuItem = z.infer<typeof LandingMenuItemSchema>;

/** Índice público: o que toda página da landing precisa saber do site. */
export type LandingSiteIndex = {
  slugs: string[];
  footer: LandingFooterLink[];
  menu: LandingMenuItem[];
};
