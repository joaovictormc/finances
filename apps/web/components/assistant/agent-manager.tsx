"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useToast } from "@/components/ui/toast-provider";

export type Agent = {
  id: string;
  name: string;
  icon: string | null;
  instructions: string;
  enabledTools: string[];
};

type Tool = { name: string; label: string };

type Preset = {
  slug: string;
  name: string;
  icon: string;
  description: string;
  instructions: string;
  enabledTools: string[];
};

type Draft = {
  id?: string;
  name: string;
  icon: string;
  instructions: string;
  enabledTools: string[];
};

const EMPTY_DRAFT: Draft = { name: "", icon: "", instructions: "", enabledTools: [] };

export function AgentManager({
  open,
  onClose,
  agents,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  agents: Agent[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const confirm = useConfirm();

  const [tools, setTools] = useState<Tool[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const loadCatalog = useCallback(async () => {
    try {
      const [tls, pre] = await Promise.all([
        api.get<Tool[]>("/api/assistant/tools"),
        api.get<Preset[]>("/api/assistant/presets"),
      ]);
      setTools(tls);
      setPresets(pre);
    } catch {
      // sem a lista, o formulário ainda salva com "todas as ferramentas"
    }
  }, []);

  useEffect(() => {
    if (open) loadCatalog();
  }, [open, loadCatalog]);

  function toggleTool(name: string) {
    if (!draft) return;
    const enabled = draft.enabledTools.includes(name)
      ? draft.enabledTools.filter((t) => t !== name)
      : [...draft.enabledTools, name];
    setDraft({ ...draft, enabledTools: enabled });
  }

  async function handleSave() {
    if (!draft || !draft.name.trim() || !draft.instructions.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        icon: draft.icon.trim() || undefined,
        instructions: draft.instructions.trim(),
        enabledTools: draft.enabledTools,
      };

      if (draft.id) {
        await api.patch(`/api/assistant/agents/${draft.id}`, payload);
      } else {
        await api.post("/api/assistant/agents", payload);
      }

      setDraft(null);
      onChanged();
      toast({ title: draft.id ? "Agente atualizado" : "Agente criado", variant: "success" });
    } catch (err) {
      toast({ title: "Erro ao salvar", description: (err as Error).message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(agent: Agent) {
    const ok = await confirm({
      title: `Excluir ${agent.name}`,
      description: "As conversas desse agente continuam salvas, mas ficam sem agente.",
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await api.delete(`/api/assistant/agents/${agent.id}`);
      onChanged();
    } catch {
      toast({ title: "Erro ao excluir", variant: "error" });
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Agentes personalizados">
      {draft ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="w-20">
              <Input
                label="Ícone"
                placeholder="💰"
                maxLength={8}
                value={draft.icon}
                onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
              />
            </div>
            <div className="flex-1">
              <Input
                label="Nome"
                placeholder="Ex: Coach de economia"
                maxLength={60}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label htmlFor="instructions" className="block text-sm font-medium mb-1">
              Instruções
            </label>
            <textarea
              id="instructions"
              rows={4}
              maxLength={2000}
              placeholder="Ex: Foque em encontrar gastos supérfluos e sugerir onde cortar para eu juntar dinheiro para uma viagem."
              value={draft.instructions}
              onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Define o assunto e o tom do agente.
            </p>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Dados que ele pode consultar</p>
            <p className="text-xs text-muted-foreground mb-2">
              Nenhum marcado = acesso a tudo. Marcando alguns, o agente recusa perguntas fora
              desse escopo em vez de responder com o dado errado.
            </p>
            <div className="space-y-2">
              {tools.map((tool) => (
                <label key={tool.name} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.enabledTools.includes(tool.name)}
                    onChange={() => toggleTool(tool.name)}
                    className="rounded border-border"
                  />
                  {tool.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!draft.name.trim() || !draft.instructions.trim()}
            >
              Salvar
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum agente ainda. Crie um para conversar sobre um assunto específico com um
              recorte próprio dos seus dados.
            </p>
          ) : (
            agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 p-3"
              >
                <span className="text-lg">{agent.icon || "🤖"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{agent.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {agent.enabledTools.length === 0
                      ? "Todas as ferramentas"
                      : `${agent.enabledTools.length} de 5 ferramentas`}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Editar ${agent.name}`}
                  onClick={() =>
                    setDraft({
                      id: agent.id,
                      name: agent.name,
                      icon: agent.icon ?? "",
                      instructions: agent.instructions,
                      enabledTools: agent.enabledTools,
                    })
                  }
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  aria-label={`Excluir ${agent.name}`}
                  onClick={() => handleDelete(agent)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}

          <Button onClick={() => setDraft({ ...EMPTY_DRAFT })} className="w-full justify-center">
            <Plus size={16} /> Novo agente
          </Button>

          {/* Presets abrem o formulário preenchido em vez de criar direto: o
              usuário vê o que vai ser criado e pode ajustar antes de salvar. */}
          {presets.length > 0 && (
            <div className="pt-2">
              <p className="text-sm font-medium mb-1">Modelos prontos</p>
              <p className="text-xs text-muted-foreground mb-2">
                Começam preenchidos; você pode editar tudo antes de salvar.
              </p>
              <div className="space-y-2">
                {presets.map((preset) => (
                  <button
                    key={preset.slug}
                    type="button"
                    onClick={() =>
                      setDraft({
                        name: preset.name,
                        icon: preset.icon,
                        instructions: preset.instructions,
                        enabledTools: preset.enabledTools,
                      })
                    }
                    className="flex w-full items-center gap-3 rounded-xl border border-border/60 p-3 text-left hover:bg-muted/60"
                  >
                    <span className="text-lg">{preset.icon}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium">{preset.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {preset.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
