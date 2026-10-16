"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, PencilLine } from "lucide-react";
import { CreateLandingPageSchema } from "@finances/validations";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";
import { LANDING_URL, publicPath, type AdminLandingPage } from "@/components/admin/landing/types";
import { MenuEditor } from "@/components/admin/landing/menu-editor";

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function StatusBadge({ page }: { page: AdminLandingPage }) {
  if (!page.publishedAt)
    return <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Não publicada</span>;
  if (page.hasUnpublishedChanges)
    return (
      <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-foreground">Alterações não publicadas</span>
    );
  return <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-foreground">Publicada</span>;
}

export default function AdminLandingPagesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [pages, setPages] = useState<AdminLandingPage[] | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setPages(await api.get<AdminLandingPage[]>("/api/admin/landing/pages"));
    } catch {
      toast({ title: "Erro ao carregar as páginas da landing", variant: "error" });
      setPages([]);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const parsed = CreateLandingPageSchema.safeParse({ title, slug });
    if (!parsed.success) {
      toast({ title: parsed.error.issues[0]?.message ?? "Confira título e endereço", variant: "error" });
      return;
    }
    setCreating(true);
    try {
      const page = await api.post<AdminLandingPage>("/api/admin/landing/pages", parsed.data);
      router.push(`/admin/landing/${page.id}`);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erro ao criar a página", variant: "error" });
      setCreating(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <BackButton href="/admin" label="Administração" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Landing page</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edite os textos e blocos do site de anúncio e crie páginas novas. Nada vai ao ar até você publicar.
        </p>
      </div>

      <section className="rounded-2xl border border-border/60 bg-card shadow-sm">
        {pages === null ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {pages.map((page) => (
              <li key={page.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    {page.isHome ? "Página inicial" : page.title}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">{publicPath(page.slug, page.isHome)}</p>
                </div>
                <StatusBadge page={page} />
                {page.showInFooter && <span className="text-xs text-muted-foreground">No rodapé</span>}
                <div className="flex items-center gap-1">
                  {page.publishedAt && (
                    <a
                      href={`${LANDING_URL}${publicPath(page.slug, page.isHome)}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Ver ${page.isHome ? "página inicial" : page.title} no site`}
                      className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                  <Link
                    href={`/admin/landing/${page.id}`}
                    className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                  >
                    <PencilLine size={15} /> Editar
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">Menu do site</h2>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">
          Links do cabeçalho e do rodapé em todas as páginas. Vale ao salvar, sem precisar publicar.
        </p>
        <MenuEditor />
      </section>

      <section className="mt-6 rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">Nova página</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Para Termos de uso, Privacidade, Sobre e o que mais precisar. Ela nasce vazia: você adiciona os blocos no editor.
        </p>
        <form onSubmit={create} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Título
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              placeholder="Termos de uso"
              maxLength={80}
              className="h-10 rounded-md border border-border bg-card px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Endereço
            <span className="flex items-center rounded-md border border-border bg-card focus-within:ring-2 focus-within:ring-primary">
              <span className="pl-3 font-mono text-sm font-normal text-muted-foreground">/</span>
              <input
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="termos-de-uso"
                maxLength={60}
                className="h-10 w-full rounded-md bg-transparent px-1 font-mono text-sm font-normal focus:outline-none"
              />
            </span>
          </label>
          <Button type="submit" loading={creating} className="h-10">
            Criar página
          </Button>
        </form>
      </section>
    </div>
  );
}
