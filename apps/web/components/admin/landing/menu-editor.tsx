"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LANDING_MENU, LandingMenuSchema, type LandingMenuItem } from "@finances/validations";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";
import { FieldsEditor, type FieldErrors } from "./fields-editor";
import type { FieldSpec } from "./block-fields";

const MENU_FIELDS: FieldSpec[] = [
  {
    key: "menu",
    label: "Itens",
    kind: "list",
    itemLabel: "Item",
    min: 0,
    max: 6,
    newItem: { label: "Novo item", href: "#" },
    hint: "#ancora leva à seção da página inicial; /pagina, a uma página criada aqui; signup e login, ao app.",
    fields: [
      { key: "label", label: "Texto", kind: "text" },
      { key: "href", label: "Destino", kind: "href" },
    ],
  },
];

/** Menu do cabeçalho (e da coluna de seções do rodapé) em todas as páginas. */
export function MenuEditor() {
  const { toast } = useToast();
  const [menu, setMenu] = useState<LandingMenuItem[] | null>(null);
  const [saved, setSaved] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<{ menu: LandingMenuItem[] }>("/api/admin/landing/menu")
      .then(({ menu }) => {
        setMenu(menu);
        setSaved(JSON.stringify(menu));
      })
      .catch(() => toast({ title: "Erro ao carregar o menu", variant: "error" }));
  }, [toast]);

  if (!menu) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  const dirty = JSON.stringify(menu) !== saved;

  async function save() {
    const parsed = LandingMenuSchema.safeParse(menu);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) next[["menu", ...issue.path].join(".")] ??= issue.message;
      setErrors(next);
      toast({ title: "Há itens do menu para corrigir", variant: "error" });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const result = await api.patch<{ menu: LandingMenuItem[]; revalidated: boolean }>("/api/admin/landing/menu", {
        menu: parsed.data,
      });
      setMenu(result.menu);
      setSaved(JSON.stringify(result.menu));
      toast(
        result.revalidated
          ? { title: "Menu salvo", description: "Já aparece em todas as páginas do site.", variant: "success" }
          : { title: "Menu salvo", description: "A landing não respondeu ao aviso; aparece em até 1 hora.", variant: "warning" }
      );
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erro ao salvar o menu", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <FieldsEditor
        fields={MENU_FIELDS}
        value={{ menu }}
        onChange={(next) => setMenu(next.menu as LandingMenuItem[])}
        errors={errors}
      />
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setMenu(structuredClone(DEFAULT_LANDING_MENU))}
        >
          Restaurar menu padrão
        </Button>
        <Button type="button" size="sm" onClick={() => void save()} disabled={!dirty} loading={saving}>
          Salvar menu
        </Button>
      </div>
    </div>
  );
}
