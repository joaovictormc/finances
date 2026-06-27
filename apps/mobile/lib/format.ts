export function formatBRL(value: number | string): string {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Dias até uma data (negativo = no passado). Compara só a parte de data.
export function daysUntil(value: string | Date): number {
  const d = typeof value === "string" ? new Date(value) : value;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}
