"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, Trash2 } from "lucide-react";
import {
  BLANK_SECTION_DATA,
  LANDING_BLOCK_LABELS,
  LandingSectionsSchema,
  UpdateLandingPageSchema,
  type LandingSection,
  type LandingSectionType,
} from "@finances/validations";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-provider";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { BLOCK_FIELDS } from "@/components/admin/landing/block-fields";
import { FieldsEditor, type FieldErrors } from "@/components/admin/landing/fields-editor";
import { LANDING_URL, publicPath, type AdminLandingPage } from "@/components/admin/landing/types";

type Form = Pick<AdminLandingPage, "title" | "slug" | "description" | "showInFooter" | "sections">;

const BLOCK_TYPES = Object.keys(LANDING_BLOCK_LABELS) as LandingSectionType[];

function toForm(page: AdminLandingPage): Form {
  return {
    title: page.title,
    slug: page.slug,
    description: page.description,
    showInFooter: page.showInFooter,
    sections: page.sections,
  };
}

/** Texto curto para identificar o bloco na lista recolhida. */
function sectionSummary(section: LandingSection): string {
  const data = section.data as { title?: string };
  return data.title?.trim() || "Sem título";
}

/** Erros da validação agrupados por bloco: { 2: { "rows.0.amount": "…" } }. */
function sectionErrors(sections: LandingSection[]): Record<number, FieldErrors> {
  const result = LandingSectionsSchema.safeParse(sections);
  if (result.success) return {};
  const grouped: Record<number, FieldErrors> = {};
  for (const issue of result.error.issues) {
    const [index, scope, ...rest] = issue.path;
    if (typeof index !== "number") continue;
    const key = scope === "data" ? rest.join(".") : String(scope ?? "");
    (grouped[index] ??= {})[key] ??= issue.message;
  }
  return grouped;
}

const inputClass =
  "h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

export default function AdminLandingEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [page, setPage] = useState<AdminLandingPage | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [newType, setNewType] = useState<LandingSectionType>("text");
  const [busy, setBusy] = useState<"save" | "publish" | "preview" | "discard" | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<AdminLandingPage>(`/api/admin/landing/pages/${id}`);
      setPage(data);
      setForm(toForm(data));
      setSaved(JSON.stringify(toForm(data)));
    } catch {
      toast({ title: "Página não encontrada", variant: "error" });
      router.push("/admin/landing");
    }
  }, [id, router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = form !== null && JSON.stringify(form) !== saved;
  const errors = useMemo(() => (form ? sectionErrors(form.sections) : {}), [form]);
  const hasErrors = Object.keys(errors).length > 0;

  // Sair com alteração não salva pede confirmação do navegador.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!page || !form) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const setSections = (sections: LandingSection[]) => setForm({ ...form, sections });
  const updateSection = (index: number, next: LandingSection) =>
    setSections(form.sections.map((s, i) => (i === index ? next : s)));
  const moveSection = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= form.sections.length) return;
    const next = [...form.sections];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setSections(next);
  };
  const toggleOpen = (sectionId: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });

  function addSection() {
    const sectionId = `${newType}-${Math.random().toString(36).slice(2, 8)}`;
    const section = {
      id: sectionId,
      type: newType,
      anchor: "",
      hidden: false,
      data: structuredClone(BLANK_SECTION_DATA[newType]),
    } as LandingSection;
    setSections([...form!.sections, section]);
    setOpen((prev) => new Set(prev).add(sectionId));
  }

  async function removeSection(index: number) {
    const section = form!.sections[index]!;
    const ok = await confirm({
      title: "Remover bloco",
      description: `Remover "${LANDING_BLOCK_LABELS[section.type]} · ${sectionSummary(section)}" desta página? A versão publicada só muda quando você publicar.`,
      confirmLabel: "Remover",
      variant: "destructive",
    });
    if (ok) setSections(form!.sections.filter((_, i) => i !== index));
  }

  /** Valida e salva o rascunho. Devolve false quando algo impede. */
  async function save(): Promise<boolean> {
    if (!form) return false;
    const parsed = UpdateLandingPageSchema.safeParse(form);
    if (!parsed.success) {
      setShowErrors(true);
      const firstBad = Object.keys(errors).map(Number)[0];
      if (firstBad !== undefined) setOpen((prev) => new Set(prev).add(form.sections[firstBad]!.id));
      toast({ title: "Há campos para corrigir antes de salvar", variant: "error" });
      return false;
    }
    try {
      const data = await api.patch<AdminLandingPage>(`/api/admin/landing/pages/${id}`, parsed.data);
      setPage(data);
      setForm(toForm(data));
      setSaved(JSON.stringify(toForm(data)));
      setShowErrors(false);
      return true;
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erro ao salvar o rascunho", variant: "error" });
      return false;
    }
  }

  async function handleSave() {
    setBusy("save");
    if (await save()) toast({ title: "Rascunho salvo", variant: "success" });
    setBusy(null);
  }

  async function handlePreview() {
    // Abre a aba no clique (antes de qualquer await): navegadores bloqueiam
    // janela aberta depois de uma espera assíncrona.
    const tab = window.open("about:blank", "_blank");
    setBusy("preview");
    try {
      if (dirty && !(await save())) {
        tab?.close();
        return;
      }
      const { token } = await api.post<{ token: string }>(`/api/admin/landing/pages/${id}/preview-token`, {});
      const url = `${LANDING_URL}/preview/${token}`;
      if (tab) tab.location.href = url;
      else window.open(url, "_blank");
    } catch (err) {
      tab?.close();
      toast({ title: err instanceof Error ? err.message : "Erro ao gerar a pré-visualização", variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function handlePublish() {
    if (!(await confirm({
      title: "Publicar página",
      description: `As alterações de "${page!.isHome ? "Página inicial" : form!.title}" vão ao ar para todos os visitantes.`,
      confirmLabel: "Publicar",
    }))) return;
    setBusy("publish");
    try {
      if (dirty && !(await save())) return;
      const result = await api.post<{ page: AdminLandingPage; revalidated: boolean }>(
        `/api/admin/landing/pages/${id}/publish`,
        {}
      );
      setPage(result.page);
      setForm(toForm(result.page));
      setSaved(JSON.stringify(toForm(result.page)));
      toast(
        result.revalidated
          ? { title: "Publicado", description: "O site já mostra a nova versão.", variant: "success" }
          : {
              title: "Publicado",
              description: "A landing não respondeu ao aviso; a nova versão aparece em até 1 hora.",
              variant: "warning",
            }
      );
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erro ao publicar", variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function handleDiscard() {
    if (!(await confirm({
      title: "Descartar rascunho",
      description: "O rascunho volta a ser igual à versão publicada. As alterações não publicadas serão perdidas.",
      confirmLabel: "Descartar",
      variant: "destructive",
    }))) return;
    setBusy("discard");
    try {
      const data = await api.post<AdminLandingPage>(`/api/admin/landing/pages/${id}/discard`, {});
      setPage(data);
      setForm(toForm(data));
      setSaved(JSON.stringify(toForm(data)));
      toast({ title: "Rascunho descartado", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erro ao descartar", variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function handleDeletePage() {
    if (!(await confirm({
      title: "Excluir página",
      description: `Excluir "${form!.title}"? Ela sai do site e o endereço deixa de existir.`,
      confirmLabel: "Excluir",
      variant: "destructive",
    }))) return;
    try {
      await api.delete(`/api/admin/landing/pages/${id}`);
      toast({ title: "Página excluída", variant: "success" });
      router.push("/admin/landing");
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erro ao excluir", variant: "error" });
    }
  }

  const status = !page.publishedAt
    ? "Nunca publicada"
    : page.hasUnpublishedChanges || dirty
      ? "Há alterações não publicadas"
      : "Igual à versão publicada";

  return (
    <div className="max-w-4xl">
      <BackButton href="/admin/landing" label="Landing page" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{page.isHome ? "Página inicial" : form.title || "Página"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono">{publicPath(form.slug, page.isHome)}</span> · {status}
        </p>
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">Página</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Título (aba do navegador e Google)
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={80}
              className={inputClass}
            />
          </label>
          {!page.isHome && (
            <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
              Endereço
              <span className="flex items-center rounded-md border border-border bg-card focus-within:ring-2 focus-within:ring-primary">
                <span className="pl-3 font-mono text-sm font-normal text-muted-foreground">/</span>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                  maxLength={60}
                  className="h-10 w-full rounded-md bg-transparent px-1 font-mono text-sm font-normal focus:outline-none"
                />
              </span>
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground sm:col-span-2">
            Descrição (aparece no Google e ao compartilhar)
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              maxLength={200}
              className={cn(inputClass, "h-auto resize-y py-2")}
            />
          </label>
          {!page.isHome && (
            <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={form.showInFooter}
                onChange={(e) => setForm({ ...form, showInFooter: e.target.checked })}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              Mostrar link no rodapé do site
            </label>
          )}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Título, endereço, descrição e rodapé valem ao salvar. Os blocos abaixo só vão ao ar quando você publicar.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-semibold">Blocos</h2>
        {form.sections.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
            Esta página ainda não tem blocos. Adicione o primeiro abaixo.
          </p>
        )}

        <ol className="flex flex-col gap-3">
          {form.sections.map((section, index) => {
            const isOpen = open.has(section.id);
            const blockErrors = showErrors ? (errors[index] ?? {}) : {};
            const hasBlockErrors = Object.keys(errors[index] ?? {}).length > 0;
            return (
              <li
                key={section.id}
                className={cn(
                  "rounded-2xl border bg-card shadow-sm",
                  showErrors && hasBlockErrors ? "border-destructive" : "border-border/60",
                  section.hidden && "opacity-70"
                )}
              >
                <div className="flex items-center gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleOpen(section.id)}
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-1 text-left"
                  >
                    <ChevronDown
                      size={16}
                      className={cn("shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-muted-foreground">
                        {LANDING_BLOCK_LABELS[section.type]}
                        {section.hidden && " · oculto"}
                        {showErrors && hasBlockErrors && <span className="text-destructive"> · campos para corrigir</span>}
                      </span>
                      <span className="block truncate text-sm font-medium text-foreground">{sectionSummary(section)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(index, -1)}
                    disabled={index === 0}
                    aria-label="Mover bloco para cima"
                    className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(index, 1)}
                    disabled={index === form.sections.length - 1}
                    aria-label="Mover bloco para baixo"
                    className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSection(index, { ...section, hidden: !section.hidden })}
                    aria-label={section.hidden ? "Mostrar bloco no site" : "Ocultar bloco do site"}
                    title={section.hidden ? "Mostrar no site" : "Ocultar do site"}
                    className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {section.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeSection(index)}
                    aria-label="Remover bloco"
                    className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-border/60 px-4 pb-6 pt-5 sm:px-5">
                    <label className="mb-5 flex flex-col gap-1 text-sm font-medium text-foreground md:w-[calc(50%-0.5rem)]">
                      Âncora (para links #)
                      <span className="flex items-center rounded-md border border-border bg-card focus-within:ring-2 focus-within:ring-primary">
                        <span className="pl-3 font-mono text-sm font-normal text-muted-foreground">#</span>
                        <input
                          value={section.anchor ?? ""}
                          onChange={(e) => updateSection(index, { ...section, anchor: e.target.value.toLowerCase() })}
                          maxLength={40}
                          className="h-10 w-full rounded-md bg-transparent px-1 font-mono text-sm font-normal focus:outline-none"
                        />
                      </span>
                      {blockErrors.anchor && <span className="text-xs font-normal text-destructive">{blockErrors.anchor}</span>}
                    </label>
                    <FieldsEditor
                      fields={BLOCK_FIELDS[section.type]}
                      value={section.data as Record<string, unknown>}
                      onChange={(data) => updateSection(index, { ...section, data } as LandingSection)}
                      errors={blockErrors}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm font-medium text-foreground">
            Novo bloco
            <select value={newType} onChange={(e) => setNewType(e.target.value as LandingSectionType)} className={inputClass}>
              {BLOCK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {LANDING_BLOCK_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" variant="outline" onClick={addSection} className="h-10">
            Adicionar bloco
          </Button>
        </div>
      </section>

      {!page.isHome && (
        <section className="mt-10 border-t border-border/60 pt-6">
          <Button type="button" variant="ghost" onClick={() => void handleDeletePage()} className="text-destructive">
            <Trash2 size={15} className="mr-1.5" /> Excluir página
          </Button>
        </section>
      )}

      {/* Barra de ações: sticky (não fixed) para ter a largura e o alinhamento
          da coluna do editor, com a sidebar aberta ou recolhida. */}
      <div className="sticky bottom-[5.5rem] z-20 mt-8 rounded-2xl lg:bottom-4 border border-border bg-card shadow-[0_12px_32px_-12px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span className="text-sm text-muted-foreground">
            {dirty ? "Alterações não salvas" : page.hasUnpublishedChanges ? "Rascunho salvo, não publicado" : "Tudo publicado"}
            {showErrors && hasErrors && <span className="text-destructive"> · corrija os campos marcados</span>}
          </span>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {page.publishedAt && page.hasUnpublishedChanges && !dirty && (
            <Button type="button" variant="ghost" size="sm" onClick={() => void handleDiscard()} loading={busy === "discard"}>
              Descartar rascunho
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => void handleSave()} disabled={!dirty} loading={busy === "save"}>
            Salvar rascunho
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void handlePreview()} loading={busy === "preview"}>
            Pré-visualizar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handlePublish()}
            disabled={!dirty && !page.hasUnpublishedChanges}
            loading={busy === "publish"}
          >
            Publicar
          </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
