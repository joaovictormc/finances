import { groq } from "./groq-client";
import { getAiSettings, isWithinUsageLimit, logAiUsage } from "./ai-settings";
import { ParsedReceiptSchema, type ParsedReceipt } from "@finances/validations";

const SYSTEM_PROMPT = `Você é um assistente especializado em ler fotos de cupons fiscais, notas de maquininha de cartão e NF-e (nota fiscal eletrônica) brasileiras.

Extraia os dados da compra e responda APENAS com um objeto JSON (sem markdown, sem texto adicional).

Formato do JSON de saída:
{
  "merchant": string (opcional, nome do estabelecimento),
  "amount": number (opcional, valor TOTAL da compra em reais),
  "date": string (opcional, formato YYYY-MM-DD),
  "categoryHint": string (opcional, ex: "supermercado", "restaurante", "farmacia", "posto de gasolina"),
  "items": [{ "description": string, "amount": number (opcional) }] (opcional, itens legíveis na nota),
  "confidence": number (0.0 a 1.0)
}

REGRAS:
1. Valores: sempre em reais, formato decimal com ponto (ex: 45.90)
2. Se a imagem não for um cupom/nota legível, retorne confidence baixo (< 0.3) e omita os campos que não conseguir ler
3. categoryHint: nome em português, sem acentos preferível
4. Nunca invente valores — se não conseguir ler algo com segurança, omita o campo`;

/**
 * O modelo não tem noção de data corrente. Sem receber "hoje" ele chuta o ano
 * quando o cupom mostra só dia/mês ou o ano está ilegível — e um gasto lançado
 * no ano errado some da lista de transações, que é ordenada por data.
 */
function buildSystemPrompt(todayIso: string) {
  return `${SYSTEM_PROMPT}

CONTEXTO DE DATA:
- Hoje é ${todayIso}.
- Cupom brasileiro escreve data como DD/MM/AAAA — "05/08" é 5 de agosto, nunca 8 de maio.
- Cupom fiscal é quase sempre do mesmo dia ou de poucos dias atrás.
- Se o ano não estiver legível, use o ano de hoje.
- Nunca devolva uma data no futuro.
- Se a data não estiver CLARAMENTE legível, omita o campo "date". Chutar a data é pior
  do que não informá-la: o gasto vai parar num mês errado e desaparece da lista do usuário.

O mesmo vale para "merchant": só devolva o nome do estabelecimento se conseguir lê-lo
com clareza. Não complete nem adivinhe nome parcialmente legível.`;
}

/**
 * Rede de segurança do prompt acima: melhor cair no padrão (hoje, no
 * formulário) do que gravar um gasto num ano errado.
 */
function sanitizeReceiptDate(date: string | undefined, today: Date): string | undefined {
  if (!date) return undefined;

  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;

  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  if (parsed > tomorrow) return undefined;

  const fiveYearsAgo = new Date(today);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  if (parsed < fiveYearsAgo) return undefined;

  return date;
}

/**
 * Interpreta uma foto de cupom fiscal/NF-e via modelo de visão da Groq.
 * Nunca cria a transação sozinho — só devolve o JSON estruturado pro
 * usuário revisar e confirmar (mesmo princípio da sugestão de categoria).
 */
export async function parseReceiptImage(
  imageBuffer: Buffer,
  mimeType: string,
  userId?: string
): Promise<ParsedReceipt | null> {
  const settings = await getAiSettings();
  if (!settings.receiptScanEnabled || !(await isWithinUsageLimit(settings))) return null;

  const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
  const today = new Date();

  const response = await groq.chat.completions.create({
    model: settings.visionModel,
    messages: [
      { role: "system", content: buildSystemPrompt(today.toISOString().slice(0, 10)) },
      {
        role: "user",
        content: [
          { type: "text", text: "Extraia os dados desse cupom/nota fiscal." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  await logAiUsage({ userId, feature: "receipt_scan", model: settings.visionModel, usage: response.usage });

  const raw = response.choices[0]?.message?.content;
  if (!raw) return null;

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }

  const parsed = ParsedReceiptSchema.safeParse(json);
  if (!parsed.success) return null;

  return { ...parsed.data, date: sanitizeReceiptDate(parsed.data.date, today) };
}

/**
 * Traduz uma falha da Groq em mensagem que faz sentido pro usuário do app.
 * O free tier tem só 8.000 tokens/min e cada foto custa ~2.000, então esbarrar
 * no limite é comum o suficiente pra merecer texto próprio.
 */
export function describeReceiptScanFailure(error: unknown): string {
  const status = (error as { status?: number })?.status;
  const message = (error as { error?: { error?: { message?: string } } })?.error?.error?.message ?? "";

  if (status === 429) {
    return "Muitas leituras em pouco tempo — espere alguns segundos e tente de novo.";
  }
  if (message.includes("invalid image data") || message.includes("invalid base64")) {
    return "Não consegui decodificar a foto. Tente tirar de novo, com boa luz e o cupom inteiro no quadro.";
  }
  if (status === 400 && message.includes("decommissioned")) {
    return "O modelo de IA configurado não existe mais — ajuste o modelo de visão em /admin/ai.";
  }
  return "A leitura por IA falhou agora. Tente de novo em instantes.";
}
