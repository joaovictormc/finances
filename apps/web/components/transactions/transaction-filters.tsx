"use client";

import { useEffect, useRef } from "react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { Category, Group } from "@/lib/types";

export interface TransactionFilters {
  search: string;
  type: string;
  startDate: string;
  endDate: string;
  groupId: string;
  /** "" = todas; "none" = sem categoria. */
  categoryId: string;
}

interface TransactionFiltersProps {
  filters: TransactionFilters;
  groups: Group[];
  categories: Category[];
  onChange: (filters: TransactionFilters) => void;
  onNew: () => void;
}

export function TransactionFilters({ filters, groups, categories, onChange, onNew }: TransactionFiltersProps) {
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (value: string) => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      onChange({ ...filters, search: value });
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (searchRef.current) clearTimeout(searchRef.current);
    };
  }, []);

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <input
        type="text"
        defaultValue={filters.search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Buscar transações..."
        className="flex-1 min-w-[200px] rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <select
        value={filters.type}
        onChange={(e) => {
          const type = e.target.value;
          // Categoria de outro tipo some do select e deixaria a lista vazia
          // sem motivo aparente: limpa junto.
          const selected = categories
            .flatMap((c) => [c, ...(c.children ?? [])])
            .find((c) => c.id === filters.categoryId);
          const keepCategory = !type || !selected || selected.type === type;
          onChange({ ...filters, type, categoryId: keepCategory ? filters.categoryId : "" });
        }}
        className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">Todos os tipos</option>
        <option value="income">Receitas</option>
        <option value="expense">Gastos</option>
        <option value="transfer">Transferências</option>
      </select>
      <select
        value={filters.categoryId}
        onChange={(e) => onChange({ ...filters, categoryId: e.target.value })}
        aria-label="Categoria"
        className="max-w-[220px] rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">Todas as categorias</option>
        <option value="none">Sem categoria</option>
        {categories
          // Com um tipo escolhido, só as categorias daquele tipo fazem sentido.
          .filter((c) => !filters.type || c.type === filters.type)
          .flatMap((c) => [
            <option key={c.id} value={c.id}>
              {c.icon ? `${c.icon} ` : ""}
              {c.name}
            </option>,
            ...(c.children ?? []).map((child) => (
              <option key={child.id} value={child.id}>
                {"\u00A0\u00A0\u00A0"}
                {child.icon ? `${child.icon} ` : ""}
                {child.name}
              </option>
            )),
          ])}
      </select>
      <DateRangePicker
        startDate={filters.startDate}
        endDate={filters.endDate}
        onChange={(r) => onChange({ ...filters, ...r })}
      />
      <select
        value={filters.groupId}
        onChange={(e) => onChange({ ...filters, groupId: e.target.value })}
        className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">Pessoal + Grupos</option>
        <option value="personal">Só Pessoal</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
      <button
        onClick={onNew}
        className="ml-auto rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
      >
        + Nova Transação
      </button>
    </div>
  );
}
