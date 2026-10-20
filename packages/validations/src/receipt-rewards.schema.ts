import { z } from "zod";

/**
 * Termo da área de recompensa por cupom fiscal. Separado da Política de
 * Privacidade geral: só envia cupom quem aceitar esta versão. Mudou o que o
 * programa faz com os dados (ex.: recompensa em dinheiro com parceiros)? Nova
 * versão, e todo mundo aceita de novo antes de continuar.
 */
export const RECEIPT_REWARD_TERMS_VERSION = "2026-10-19";

export const RECEIPT_REWARD_TERMS: { heading: string; body: string[] }[] = [
  {
    heading: "O que é",
    body: [
      "Um programa opcional: você envia cupons fiscais das suas compras e ganha pontos no ControlAI. Participar não muda nada no resto do app.",
      "Hoje a recompensa é em pontos, que valem na roleta e nos emblemas da tela de Recompensas. Não há pagamento em dinheiro.",
    ],
  },
  {
    heading: "Quais dados entram",
    body: [
      "A chave de acesso do cupom (o número de 44 dígitos do QR Code). Dela saem o estado, o mês da compra, o CNPJ da loja e o número da nota.",
      "Quando o app passar a conferir o cupom na Secretaria da Fazenda do estado, entram também os itens comprados, os valores e a forma de pagamento que aparecem na consulta pública da nota.",
      "Se você informou CPF na compra, ele pode aparecer nessa consulta. Não usamos o CPF para nada no programa.",
    ],
  },
  {
    heading: "Para que usamos",
    body: [
      "Para conferir que o cupom é válido e ainda não foi enviado (cada cupom vale uma vez, para todo mundo) e para somar os seus pontos.",
      "Os dados deste programa não são vendidos nem compartilhados com outras empresas.",
    ],
  },
  {
    heading: "Regras",
    body: [
      "Valem cupons de compras recentes, dentro do prazo e dos limites por dia e por semana mostrados na tela.",
      "Cupons repetidos, inventados ou de outras pessoas não valem. Em caso de fraude, os pontos podem ser retirados e a participação suspensa.",
    ],
  },
  {
    heading: "Seus direitos",
    body: [
      "Você pode sair do programa quando quiser, na própria tela. Ao sair, não envia mais cupons; o histórico fica guardado para evitar que o mesmo cupom seja usado de novo e é apagado quando você exclui a sua conta.",
      "Os cupons enviados entram na exportação de dados em Configurações.",
      "Se o programa mudar o que faz com os dados, você verá o novo termo e decidirá de novo se quer continuar.",
    ],
  },
];

/** Link do QR Code (como a câmera do celular abre) ou a chave de 44 dígitos. */
export const ReceiptSubmitSchema = z.object({
  code: z.string().trim().min(20, "Cole o link do QR Code ou digite a chave de 44 dígitos").max(1000),
});

export const ReceiptConsentSchema = z.object({
  /** Versão do termo que a pessoa leu: aceitar versão antiga não vale. */
  version: z.string().min(1),
});

export type RewardReceiptSummary = {
  id: string;
  uf: string;
  model: string;
  issuedMonth: string;
  status: string;
  points: number;
  createdAt: string;
};

export type ReceiptRewardStatus = {
  enabled: boolean;
  terms: { version: string; sections: typeof RECEIPT_REWARD_TERMS };
  consent: { active: boolean; acceptedAt: string | null; outdated: boolean };
  rules: { pointsPerReceipt: number; dailyLimit: number; weeklyLimit: number; maxAgeDays: number };
  usage: { today: number; week: number };
  totals: { receipts: number; points: number };
  history: RewardReceiptSummary[];
};
