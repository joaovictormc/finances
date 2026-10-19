"use client";

import { useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilLine, Plus, Trash2, X } from "lucide-react";
import {
  CHANGELOG_ITEM_KINDS,
  CHANGELOG_KIND_LABELS,
  CHANGELOG_PLATFORM_LABELS,
  CHANGELOG_PLATFORMS,
  ChangelogReleaseInputSchema,
  type ChangelogItem,
  type ChangelogItemKind,
  type ChangelogPlatform,
} from "@finances/validations";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-provider";
import { ReleaseCard } from "@/components/changelog/release-card";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

type AdminRelease = {
  id: string;
  version: string;
  title: string;
  items: ChangelogItem[];
  platforms: ChangelogPlatform[];
  publishedAt: string | null;
  notifiedAt: string | null;
  createdAt: string;
};

type Draft = { version: string; title: string; items: ChangelogItem[]; platforms: ChangelogPlatform[] };

const EMPTY: Draft = { version: "", title: "", items: [{ kind: "fix", text: "" }], platforms: [] };

const fieldBase =
  "h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";
const control = `${fieldBase} w-full`;

export default function AdminChangelogPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminRelease | "new" | null>(null);
  const [publishing, setPublishing] = useState<AdminRelease | null>(null);
  const { data: releases, isError } = useQuery({
    queryKey: ["admin", "changelog"],
    queryFn: () => api.get<AdminRelease[]>("/api/admin/changelog"),
  });
  const load = () => queryClient.invalidateQueries({ queryKey: ["admin", "changelog"] });

  async function remove(release: AdminRelease) {
    const ok = await confirm({
      title: "Excluir novidade",
      description: release.publishedAt
        ? `"${release.title}" já foi publicada: some da tela de Novidades. Os avisos já enviados continuam no sininho de quem recebeu.`
        : `Excluir o rascunho "${release.title}"?`,
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;
    await api.delete(`/api/admin/changelog/${release.id}`);
    toast({ title: "Novidade excluída", variant: "success" });
    void load();
  }

  if (isError) {
    return <p className="py-20 text-center text-sm text-muted-foreground">Erro ao carregar as novidades.</p>;
  }

  if (!releases) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <BackButton href="/admin" label="Administração" />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novidades</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            O que mudou em cada atualização. Ao publicar, os usuários veem a janela &quot;O que há de novo&quot; e
            recebem o aviso pelos canais escolhidos.
          </p>
        </div>
        <Button type="button" onClick={() => setEditing("new")} className="h-10">
          <Plus size={16} /> Nova novidade
        </Button>
      </div>

      {releases.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma novidade ainda. Crie a primeira com o que mudou na última atualização.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-card">
          {releases.map((release) => (
            <li key={release.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  <span className="font-mono font-normal text-muted-foreground">{release.version}</span> · {release.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {release.items.length} {release.items.length === 1 ? "item" : "itens"}
                  {release.platforms.length > 0
                    ? ` · ${release.platforms.map((p) => CHANGELOG_PLATFORM_LABELS[p]).join(", ")}`
                    : " · todas as plataformas"}
                  {release.publishedAt && ` · publicada em ${formatDate(release.publishedAt)}`}
                </p>
              </div>
              {release.publishedAt ? (
                <Badge variant="success">Publicada</Badge>
              ) : (
                <>
                  <Badge variant="default">Rascunho</Badge>
                  <Button type="button" size="sm" onClick={() => setPublishing(release)}>
                    Publicar
                  </Button>
                </>
              )}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(release)}
                  aria-label={`Editar ${release.title}`}
                  className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <PencilLine size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => void remove(release)}
                  aria-label={`Excluir ${release.title}`}
                  className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Nova novidade" : "Editar novidade"}
        className="w-[560px]"
      >
        {editing !== null && (
          <ReleaseForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? undefined : editing}
            onSaved={() => {
              setEditing(null);
              void load();
            }}
          />
        )}
      </Drawer>

      <PublishDialog
        release={publishing}
        onClose={() => setPublishing(null)}
        onPublished={() => {
          setPublishing(null);
          void load();
        }}
      />
    </div>
  );
}

function ReleaseForm({ initial, onSaved }: { initial?: AdminRelease; onSaved: () => void }) {
  const { toast } = useToast();
  const id = useId();
  const [draft, setDraft] = useState<Draft>(
    initial ? { version: initial.version, title: initial.title, items: initial.items, platforms: initial.platforms } : EMPTY
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const setItem = (index: number, patch: Partial<ChangelogItem>) =>
    setDraft((d) => ({ ...d, items: d.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));

  const togglePlatform = (platform: ChangelogPlatform) =>
    setDraft((d) => ({
      ...d,
      platforms: d.platforms.includes(platform) ? d.platforms.filter((p) => p !== platform) : [...d.platforms, platform],
    }));

  async function save() {
    const parsed = ChangelogReleaseInputSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors([...new Set(parsed.error.issues.map((issue) => issue.message))]);
      return;
    }
    setErrors([]);
    setSaving(true);
    try {
      if (initial) await api.patch(`/api/admin/changelog/${initial.id}`, parsed.data);
      else await api.post("/api/admin/changelog", parsed.data);
      toast({ title: initial ? "Novidade salva" : "Rascunho criado", variant: "success" });
      onSaved();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Não foi possível salvar", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {initial?.publishedAt && (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Já publicada: a correção aparece na tela de Novidades, mas o aviso não é enviado de novo.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground" htmlFor={`${id}-version`}>
          Versão
          <input
            id={`${id}-version`}
            value={draft.version}
            onChange={(e) => setDraft({ ...draft, version: e.target.value })}
            placeholder="1.3.0"
            maxLength={30}
            className={`${control} font-mono`}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground" htmlFor={`${id}-title`}>
          Título
          <input
            id={`${id}-title`}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Teclado não cobre mais os campos"
            maxLength={120}
            className={control}
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-foreground">Plataformas</legend>
        <p className="mb-2 text-xs text-muted-foreground">Nenhuma marcada = vale para todas.</p>
        <div className="flex flex-wrap gap-2">
          {CHANGELOG_PLATFORMS.map((platform) => {
            const active = draft.platforms.includes(platform);
            return (
              <button
                key={platform}
                type="button"
                aria-pressed={active}
                onClick={() => togglePlatform(platform)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  active ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {CHANGELOG_PLATFORM_LABELS[platform]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">Itens</legend>
        <div className="space-y-2">
          {draft.items.map((item, index) => (
            <div key={index} className="flex items-start gap-2">
              <select
                aria-label={`Tipo do item ${index + 1}`}
                value={item.kind}
                onChange={(e) => setItem(index, { kind: e.target.value as ChangelogItemKind })}
                className={`${fieldBase} w-32 shrink-0`}
              >
                {CHANGELOG_ITEM_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {CHANGELOG_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
              <textarea
                aria-label={`Texto do item ${index + 1}`}
                value={item.text}
                onChange={(e) => setItem(index, { text: e.target.value })}
                rows={2}
                maxLength={300}
                placeholder="Escreva para quem usa o app, sem termos técnicos"
                className="min-h-10 w-full flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, items: d.items.filter((_, i) => i !== index) }))}
                disabled={draft.items.length === 1}
                aria-label={`Remover item ${index + 1}`}
                className="mt-1 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setDraft((d) => ({ ...d, items: [...d.items, { kind: "improvement", text: "" }] }))}
          disabled={draft.items.length >= 30}
        >
          <Plus size={14} /> Adicionar item
        </Button>
      </fieldset>

      {errors.length > 0 && (
        <ul className="space-y-1 text-sm text-destructive">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={() => void save()} loading={saving}>
          {initial ? "Salvar" : "Salvar rascunho"}
        </Button>
      </div>
    </div>
  );
}

function PublishDialog({
  release,
  onClose,
  onPublished,
}: {
  release: AdminRelease | null;
  onClose: () => void;
  onPublished: () => void;
}) {
  const { toast } = useToast();
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [busy, setBusy] = useState(false);

  async function publish() {
    if (!release) return;
    setBusy(true);
    try {
      await api.post(`/api/admin/changelog/${release.id}/publish`, { notifyInApp, notifyEmail });
      toast({
        title: notifyInApp || notifyEmail ? "Publicada. Os avisos estão sendo enviados." : "Publicada",
        variant: "success",
      });
      onPublished();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Não foi possível publicar", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={release !== null} onClose={onClose} title="Publicar novidade">
      {release && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border/60 p-4">
            <ReleaseCard
              release={{ ...release, publishedAt: new Date().toISOString() }}
              compact
            />
          </div>
          <fieldset className="space-y-3">
            <legend className="mb-1 text-sm font-medium text-foreground">Avisar os usuários</legend>
            <label className="flex items-start gap-3 text-sm text-foreground">
              <input type="checkbox" checked={notifyInApp} onChange={(e) => setNotifyInApp(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-primary)]" />
              <span>
                Sininho do app
                <span className="block text-xs text-muted-foreground">Na central de notificações, no web e no celular.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-foreground">
              <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-primary)]" />
              <span>
                E-mail
                <span className="block text-xs text-muted-foreground">
                  Para quem não desligou os avisos por e-mail. Prefira para mudanças que valem o e-mail.
                </span>
              </span>
            </label>
          </fieldset>
          <p className="text-xs text-muted-foreground">
            A janela &quot;O que há de novo&quot; aparece para todos na próxima abertura do app, com ou sem aviso.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void publish()} loading={busy}>
              Publicar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
