export interface ParsedTransaction {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // sempre positivo
  // "transfer" é usado quando a linha parece ser o pagamento da própria
  // fatura de cartão (ver credit-card-payment.ts) — não entra em income/
  // expense nos relatórios.
  type: "income" | "expense" | "transfer";
  externalId?: string;
}
