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

  const response = await groq.chat.completions.create({
    model: settings.visionModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
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
  return parsed.success ? parsed.data : null;
}
