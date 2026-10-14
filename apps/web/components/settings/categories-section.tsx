"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { queryKeys, useCategories } from "@/lib/queries";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CategoryCreator } from "@/components/categories/category-creator";
import { EmojiButton, EmojiGrid } from "@/components/categories/emoji-picker";
import type { Category } from "@/lib/types";

type CustomCategory = Category & { parentName: string | null };

const TYPE_TITLES: Record<string, string> = { expense: "Gastos", income: "Receitas" };

const fieldClass =
  "h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

/** Só as criadas pelo usuário — inclusive as que são subcategoria de uma padrão. */
function customCategories(categories: Category[]): CustomCategory[] {
  return categories.flatMap((parent) => [
    ...(parent.isSystem === false ? [{ ...parent, parentName: null }] : []),
    ...(parent.children ?? [])
      .filter((child) => child.isSystem === false)
      .map((child) => ({ ...child, parentName: parent.name })),
  ]);
}

export function CategoriesSection() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data: categories = [], isPending } = useCategories();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; icon: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickingEmoji, setPickingEmoji] = useState(false);

  const custom = customCategories(categories);
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.allCategories });

  async function saveEdit() {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast({ title: "Informe o nome da categoria", variant: "error" });
      return;
    }
    setBusyId(editing.id);
    try {
      await api.patch(`/api/categories/${editing.id}`, {
        name: editing.name.trim(),
        icon: editing.icon.trim() || null,
      });
      await refresh();
      setEditing(null);
      toast({ title: "Categoria atualizada", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erro ao salvar categoria", variant: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(category: CustomCategory) {
    const ok = await confirm({
      title: "Excluir categoria",
      description: `Excluir "${category.name}"? As transações com essa categoria continuam lá, mas ficam como "Sem categoria".`,
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;

    setBusyId(category.id);
    try {
      const result = await api.delete<{ uncategorizedTransactions: number }>(`/api/categories/${category.id}`);
      await refresh();
      const n = result.uncategorizedTransactions;
      toast({
        title: "Categoria excluída",
        description: n > 0 ? `${n} transaç${n === 1 ? "ão ficou" : "ões ficaram"} sem categoria.` : undefined,
        variant: "success",
      });
    } catch (err) {
      // Orçamento usando a categoria, ou subcategorias: a API explica o que fazer.
      toast({ title: err instanceof Error ? err.message : "Erro ao excluir categoria", variant: "error" });
    } finally {
      setBusyId(null);
    }
  }

  if (isPending) {
    return (
      <div className="flex justify-center py-4">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {custom.length === 0 && !creating && (
        <p className="text-sm text-muted-foreground">
          Você ainda não criou categorias. As padrão continuam disponíveis — crie as suas pra o que elas não cobrem.
        </p>
      )}

      {(["expense", "income"] as const).map((type) => {
        const items = custom.filter((c) => c.type === type);
        if (items.length === 0) return null;
        return (
          <div key={type}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
              {TYPE_TITLES[type]}
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {items.map((category) =>
                editing?.id === category.id ? (
                  <li key={category.id} className="space-y-2 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <EmojiButton
                        value={editing.icon}
                        open={pickingEmoji}
                        onToggle={() => setPickingEmoji((v) => !v)}
                      />
                      <input
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveEdit();
                          if (e.key === "Escape") setEditing(null);
                        }}
                        maxLength={40}
                        aria-label="Nome da categoria"
                        autoFocus
                        className={`${fieldClass} min-w-0 flex-1`}
                      />
                      <div className="flex gap-2 ml-auto">
                        <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={() => void saveEdit()} loading={busyId === category.id}>
                          Salvar
                        </Button>
                      </div>
                    </div>
                    {pickingEmoji && (
                      <EmojiGrid
                        value={editing.icon}
                        onSelect={(emoji) => {
                          setEditing({ ...editing, icon: emoji });
                          setPickingEmoji(false);
                        }}
                      />
                    )}
                  </li>
                ) : (
                  <li key={category.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {category.icon ? `${category.icon} ` : ""}
                      {category.name}
                      {category.parentName && (
                        <span className="text-muted-foreground"> · em {category.parentName}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing({ id: category.id, name: category.name, icon: category.icon ?? "" });
                        setPickingEmoji(false);
                      }}
                      title="Editar"
                      aria-label={`Editar ${category.name}`}
                      className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(category)}
                      disabled={busyId === category.id}
                      title="Excluir"
                      aria-label={`Excluir ${category.name}`}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                )
              )}
            </ul>
          </div>
        );
      })}

      {creating ? (
        <CategoryCreator categories={categories} onCreated={() => setCreating(false)} onCancel={() => setCreating(false)} />
      ) : (
        <Button variant="outline" onClick={() => setCreating(true)}>
          + Nova categoria
        </Button>
      )}
    </div>
  );
}
