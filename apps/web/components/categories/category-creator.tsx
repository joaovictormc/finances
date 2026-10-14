"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/queries";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";
import { EmojiButton, EmojiGrid } from "@/components/categories/emoji-picker";
import type { Category } from "@/lib/types";

export type CategoryKind = "income" | "expense";

const KIND_LABELS: Record<CategoryKind, string> = { expense: "Gasto", income: "Receita" };

const fieldClass =
  "h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary";

/**
 * Formulário curto pra criar uma categoria personalizada. Não usa <form>: ele
 * aparece dentro do formulário de transação, e form aninhado não é HTML
 * válido — o Enter no nome cria a categoria em vez de enviar a transação.
 */
export function CategoryCreator({
  type: fixedType,
  categories,
  onCreated,
  onCancel,
}: {
  /** Tipo fixo (vindo da aba da transação). Sem isso, a pessoa escolhe. */
  type?: CategoryKind;
  /** Lista atual, pra oferecer as categorias principais como mãe. */
  categories: Category[];
  onCreated: (category: Category) => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [type, setType] = useState<CategoryKind>(fixedType ?? "expense");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [parentId, setParentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [pickingEmoji, setPickingEmoji] = useState(false);

  const parents = categories.filter((c) => c.type === type);

  async function create() {
    if (!name.trim()) {
      toast({ title: "Informe o nome da categoria", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const category = await api.post<Category>("/api/categories", {
        name: name.trim(),
        type,
        icon: icon.trim() || null,
        parentId: parentId || null,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.allCategories });
      toast({ title: `Categoria "${category.name}" criada`, variant: "success" });
      onCreated({ ...category, children: [] });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erro ao criar categoria", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-3">
      <p className="text-sm font-medium text-foreground">Nova categoria</p>

      {!fixedType && (
        <div className="flex gap-2" role="radiogroup" aria-label="Tipo da categoria">
          {(Object.keys(KIND_LABELS) as CategoryKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={type === kind}
              onClick={() => {
                setType(kind);
                setParentId("");
              }}
              className={
                type === kind
                  ? "rounded-md border border-foreground/20 bg-card px-3 py-1.5 text-sm font-medium text-foreground"
                  : "rounded-md border border-transparent px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              }
            >
              {KIND_LABELS[kind]}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <EmojiButton value={icon} open={pickingEmoji} onToggle={() => setPickingEmoji((v) => !v)} />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void create();
            }
          }}
          placeholder="Nome (ex.: Pets, Academia)"
          maxLength={40}
          aria-label="Nome da categoria"
          autoFocus
          className={`${fieldClass} min-w-0 flex-1`}
        />
      </div>

      {pickingEmoji && (
        <EmojiGrid
          value={icon}
          onSelect={(emoji) => {
            setIcon(emoji);
            setPickingEmoji(false);
          }}
        />
      )}

      <select
        value={parentId}
        onChange={(e) => setParentId(e.target.value)}
        aria-label="Categoria principal"
        className={`${fieldClass} w-full`}
      >
        <option value="">Categoria principal (sem mãe)</option>
        {parents.map((c) => (
          <option key={c.id} value={c.id}>
            Subcategoria de {c.icon ? `${c.icon} ` : ""}
            {c.name}
          </option>
        ))}
      </select>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" size="sm" onClick={() => void create()} loading={saving}>
          Criar categoria
        </Button>
      </div>
    </div>
  );
}
