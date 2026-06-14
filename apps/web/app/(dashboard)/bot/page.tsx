import type { Metadata } from "next";

export const metadata: Metadata = { title: "Integração Bot" };

export default function BotPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Integração com Bot</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Registre gastos e receitas pelo Telegram ou WhatsApp
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Telegram */}
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
              ✈️
            </div>
            <div>
              <h2 className="font-semibold">Telegram</h2>
              <p className="text-xs text-muted-foreground">Gratuito, disponível agora</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Envie mensagens de texto ou áudio para o bot e ele registrará automaticamente
            seus gastos e receitas usando IA.
          </p>

          <div className="bg-muted rounded-md p-3 mb-4">
            <p className="text-xs font-mono">
              Exemplos:<br />
              "gastei 50 no mercado"<br />
              "recebi salário de 3200"<br />
              "uber 23 conto"
            </p>
          </div>

          <TelegramLinkSection />
        </div>

        {/* WhatsApp */}
        <div className="bg-card rounded-lg border border-border p-6 opacity-70">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">
              💬
            </div>
            <div>
              <h2 className="font-semibold">WhatsApp</h2>
              <p className="text-xs text-muted-foreground">Em breve (Plano Pro)</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Integração com WhatsApp Business API. Mesma experiência do Telegram,
            com suporte a mensagens de voz e botões interativos.
          </p>

          <button
            disabled
            className="w-full rounded-md bg-muted text-muted-foreground py-2 text-sm font-medium cursor-not-allowed"
          >
            Disponível em breve
          </button>
        </div>
      </div>
    </div>
  );
}

function TelegramLinkSection() {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Cole o código do Telegram aqui"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90">
          Vincular
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        1. Abra o Telegram e busque nosso bot<br />
        2. Envie /start<br />
        3. Cole o código de 6 dígitos acima
      </p>
    </div>
  );
}
