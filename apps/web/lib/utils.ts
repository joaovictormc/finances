import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formatador criado uma vez só: toLocaleString com opções monta um
// Intl.NumberFormat novo a cada chamada, e isso roda em toda linha de tabela
// e todo tick/tooltip de gráfico.
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(value: number | string): string {
  return brl.format(Number(value));
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function formatShortDate(date: Date | string): string {
  return formatDate(date);
}

export function getMonthName(date: Date = new Date()): string {
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
