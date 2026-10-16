import type { Plan } from "@/lib/plans";

/** O que todo bloco recebe além do próprio conteúdo. */
export type BlockContext = {
  /** Página inicial: âncoras ficam locais; nas demais apontam para a inicial. */
  isHome: boolean;
  /** O primeiro título da página é o h1; os demais, h2. */
  headingLevel: 1 | 2;
  plans: Plan[] | null;
};
