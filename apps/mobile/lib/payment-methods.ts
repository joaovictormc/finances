export type PaymentMethod = "debit" | "credit" | "pix" | "cash" | "boleto";

// Débito é o método implícito (padrão); os demais aparecem como opção pra
// qualquer tipo de transação (gasto/receita/transferência) — crédito só
// quando a conta selecionada tem cartão (hasCreditCard).
export const BASE_PAYMENT_METHOD_TABS: { value: PaymentMethod; label: string }[] = [
  { value: "debit", label: "Débito" },
  { value: "pix", label: "Pix" },
  { value: "cash", label: "Dinheiro" },
  { value: "boleto", label: "Boleto" },
];

export const PAYMENT_METHOD_BADGE: Partial<Record<PaymentMethod, string>> = {
  credit: "💳 Crédito",
  pix: "⚡ Pix",
  cash: "💵 Dinheiro",
  boleto: "🧾 Boleto",
};
