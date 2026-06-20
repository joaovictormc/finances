"use client";

import { useEffect, useRef } from "react";
import { DateInput } from "@/components/ui/date-input";
import type { Group } from "@/lib/types";

export interface TransactionFilters {
  search: string;
  type: string;
  startDate: string;
  endDate: string;
  groupId: string;
}

interface TransactionFiltersProps {
  filters: TransactionFilters;
  groups: Group[];
  onChange: (filters: TransactionFilters) => void;
  onNew: () => void;
}

export function TransactionFilters({ filters, groups, onChange, onNew }: TransactionFiltersProps) {
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
        onChange={(e) => onChange({ ...filters, type: e.target.value })}
        className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">Todos os tipos</option>
        <option value="income">Receitas</option>
        <option value="expense">Gastos</option>
        <option value="transfer">Transferências</option>
      </select>
      <DateInput
        value={filters.startDate}
        onChange={(isoValue) => onChange({ ...filters, startDate: isoValue })}
        placeholder="Data inicial"
        className="w-36"
      />
      <DateInput
        value={filters.endDate}
        onChange={(isoValue) => onChange({ ...filters, endDate: isoValue })}
        placeholder="Data final"
        className="w-36"
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
