export interface ParsedTransaction {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // sempre positivo
  type: "income" | "expense";
  externalId?: string;
}
