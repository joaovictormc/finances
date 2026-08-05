// Heurística pra distinguir "paguei minha própria fatura de cartão" (deveria
// ser uma transferência, não uma despesa comum) de uma despesa normal. Usada
// pelos parsers de CSV/OFX durante a importação de extrato — ver
// docs/ajustes-pos-teste.md (item "Diferenciar pagamentos de faturas de
// cartão para não ser inclusas como dinheiro recebido").
const CREDIT_CARD_PAYMENT_PATTERNS = [
  /pagamento.*fatura/i,
  /pag(?:to|amento)?\.?\s*cart(?:a|ã)o/i,
  /fatura.*cart(?:a|ã)o/i,
  /pgto\s*cart/i,
  /pagto\s*cart/i,
];

export function isCreditCardBillPayment(description: string): boolean {
  return CREDIT_CARD_PAYMENT_PATTERNS.some((pattern) => pattern.test(description));
}
