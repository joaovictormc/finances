import { LANDING_ICONS, LANDING_ROW_VISUALS, type LandingSectionType } from "@finances/validations";

/**
 * Campos de cada tipo de bloco da landing, descritos de forma declarativa:
 * o FieldsEditor monta o formulário a partir daqui. As regras (tamanho,
 * obrigatoriedade, formato de link) ficam no LandingSectionSchema, que a API
 * também aplica.
 */
export type FieldSpec =
  | { key: string; label: string; kind: "text"; hint?: string; placeholder?: string }
  | { key: string; label: string; kind: "textarea"; hint?: string; rows?: number }
  | { key: string; label: string; kind: "href"; hint?: string }
  | { key: string; label: string; kind: "boolean"; hint?: string }
  | { key: string; label: string; kind: "select"; options: { value: string; label: string }[]; hint?: string }
  | {
      key: string;
      label: string;
      kind: "list";
      itemLabel: string;
      fields: FieldSpec[];
      min: number;
      max: number;
      newItem: Record<string, unknown>;
      hint?: string;
    };

const HREF_HINT = "signup (cadastro), login, #ancora (seção desta página), /pagina (outra página) ou https://…";

const VISUAL_LABELS: Record<(typeof LANDING_ROW_VISUALS)[number], string> = {
  receipt: "Cupom fiscal lido",
  files: "Arquivos de extrato",
  habit: "Check-in e pontos",
  none: "Sem ilustração",
};

const ICON_LABELS: Record<(typeof LANDING_ICONS)[number], string> = {
  camera: "Câmera",
  file: "Arquivo",
  calendar: "Calendário",
  phone: "Celular",
  check: "Confirmação",
  users: "Pessoas",
  chart: "Gráfico",
  shield: "Escudo",
};

export const BLOCK_FIELDS: Record<LandingSectionType, FieldSpec[]> = {
  hero: [
    { key: "title", label: "Título", kind: "text" },
    { key: "subtitle", label: "Subtítulo", kind: "textarea", rows: 3 },
    { key: "primaryLabel", label: "Botão principal (leva ao cadastro)", kind: "text" },
    { key: "secondaryLabel", label: "Link secundário", kind: "text" },
    { key: "secondaryHref", label: "Destino do link secundário", kind: "href", hint: HREF_HINT },
    { key: "note", label: "Nota abaixo dos botões", kind: "text" },
    { key: "summaryLabel", label: "Resumo no celular: rótulo", kind: "text" },
    { key: "summaryValue", label: "Resumo no celular: valor", kind: "text", placeholder: "+ R$ 3.160,00" },
    { key: "demoLabel", label: "Aviso de demonstração", kind: "text" },
    {
      key: "exchanges",
      label: "Perguntas e respostas do assistente",
      kind: "list",
      itemLabel: "Pergunta",
      min: 1,
      max: 4,
      newItem: { question: "Nova pergunta?", answer: "Resposta com valores como R$ 100,00." },
      hint: "Valores escritos como R$ 1.234,56 aparecem em fonte de números; com + na frente, em azul.",
      fields: [
        { key: "question", label: "Pergunta", kind: "text" },
        { key: "answer", label: "Resposta", kind: "textarea", rows: 3 },
      ],
    },
  ],
  ledger: [
    { key: "title", label: "Título", kind: "text" },
    { key: "body", label: "Texto", kind: "textarea", rows: 3 },
    { key: "sheetTitle", label: "Cabeçalho do extrato", kind: "text" },
    { key: "period", label: "Período", kind: "text" },
    {
      key: "rows",
      label: "Lançamentos",
      kind: "list",
      itemLabel: "Lançamento",
      min: 1,
      max: 10,
      newItem: { date: "", description: "Novo lançamento", initials: "", name: "", role: "", amount: "− 0,00", income: false },
      fields: [
        { key: "date", label: "Data", kind: "text", placeholder: "01/10" },
        { key: "description", label: "Descrição", kind: "text" },
        { key: "amount", label: "Valor", kind: "text", placeholder: "− 1.182,40" },
        { key: "initials", label: "Iniciais", kind: "text", placeholder: "AN" },
        { key: "name", label: "Quem lançou", kind: "text" },
        { key: "role", label: "Papel", kind: "text" },
        { key: "income", label: "É entrada (valor em azul)", kind: "boolean" },
      ],
    },
    { key: "totalLabel", label: "Rótulo do total", kind: "text" },
    { key: "totalAmount", label: "Valor do total", kind: "text", hint: "Com + na frente, aparece em azul." },
    { key: "totalMarker", label: "Grifo amarelo no total", kind: "text" },
    { key: "footer", label: "Linha final do extrato", kind: "text" },
    { key: "marginTitle", label: "Título das notas na margem", kind: "text" },
    {
      key: "notes",
      label: "Notas na margem",
      kind: "list",
      itemLabel: "Nota",
      min: 0,
      max: 5,
      newItem: { when: "", text: "Nova nota." },
      fields: [
        { key: "when", label: "Quando", kind: "text", placeholder: "08 out" },
        { key: "text", label: "Texto", kind: "textarea", rows: 2 },
      ],
    },
  ],
  roles: [
    { key: "title", label: "Título", kind: "text" },
    { key: "body", label: "Texto", kind: "textarea", rows: 3 },
    {
      key: "note",
      label: "Nota",
      kind: "textarea",
      rows: 3,
      hint: "A primeira frase aparece em negrito. A tabela de permissões vem do sistema e não é editável.",
    },
  ],
  productRows: [
    { key: "title", label: "Título", kind: "text" },
    {
      key: "rows",
      label: "Faixas",
      kind: "list",
      itemLabel: "Faixa",
      min: 1,
      max: 6,
      newItem: { title: "Nova faixa", body: "", note: "", visual: "none" },
      fields: [
        { key: "title", label: "Título", kind: "text" },
        { key: "body", label: "Texto", kind: "textarea", rows: 3 },
        { key: "note", label: "Nota (ex.: em quais planos)", kind: "text" },
        {
          key: "visual",
          label: "Ilustração",
          kind: "select",
          options: LANDING_ROW_VISUALS.map((v) => ({ value: v, label: VISUAL_LABELS[v] })),
        },
      ],
    },
  ],
  pricing: [
    { key: "title", label: "Título", kind: "text", hint: "Preços e recursos dos planos vêm do sistema (Admin › Precificação)." },
    { key: "footnote", label: "Nota abaixo dos planos", kind: "textarea", rows: 2 },
  ],
  faq: [
    { key: "title", label: "Título", kind: "text" },
    {
      key: "items",
      label: "Perguntas",
      kind: "list",
      itemLabel: "Pergunta",
      min: 1,
      max: 12,
      newItem: { question: "Nova pergunta?", answer: "Resposta." },
      fields: [
        { key: "question", label: "Pergunta", kind: "text" },
        { key: "answer", label: "Resposta", kind: "textarea", rows: 4 },
      ],
    },
  ],
  cta: [
    { key: "title", label: "Título", kind: "text" },
    { key: "primaryLabel", label: "Botão principal", kind: "text" },
    { key: "primaryHref", label: "Destino do botão", kind: "href", hint: HREF_HINT },
    { key: "secondaryLabel", label: "Link secundário", kind: "text" },
    { key: "secondaryHref", label: "Destino do link secundário", kind: "href", hint: HREF_HINT },
  ],
  text: [
    { key: "title", label: "Título", kind: "text" },
    {
      key: "body",
      label: "Texto",
      kind: "textarea",
      rows: 14,
      hint: "Separe parágrafos com uma linha em branco. Comece a linha com ## para subtítulo e com - para item de lista.",
    },
  ],
  highlights: [
    { key: "title", label: "Título", kind: "text" },
    { key: "body", label: "Texto", kind: "textarea", rows: 3 },
    {
      key: "items",
      label: "Destaques",
      kind: "list",
      itemLabel: "Destaque",
      min: 1,
      max: 8,
      newItem: { icon: "check", title: "Novo destaque", text: "" },
      fields: [
        { key: "icon", label: "Ícone", kind: "select", options: LANDING_ICONS.map((v) => ({ value: v, label: ICON_LABELS[v] })) },
        { key: "title", label: "Título", kind: "text" },
        { key: "text", label: "Texto", kind: "textarea", rows: 2 },
      ],
    },
  ],
};
