import type { LandingSection } from "@finances/validations";

/** Página como o editor recebe de /api/admin/landing/pages. */
export type AdminLandingPage = {
  id: string;
  slug: string;
  title: string;
  description: string;
  showInFooter: boolean;
  isHome: boolean;
  sections: LandingSection[];
  publishedAt: string | null;
  updatedAt: string;
  hasUnpublishedChanges: boolean;
};

// Endereço público da landing (pré-visualização e link "ver no site").
export const LANDING_URL = (process.env.NEXT_PUBLIC_LANDING_URL ?? "http://localhost:3002").replace(/\/$/, "");

export function publicPath(slug: string, isHome: boolean) {
  return isHome ? "/" : `/${slug}`;
}
