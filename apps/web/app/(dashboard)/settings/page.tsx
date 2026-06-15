"use client";

import { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/app/providers/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: "Perfil atualizado!", variant: "success" });
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie suas preferências pessoais</p>
      </div>

      <div className="space-y-6">
        {/* Profile section */}
        <section className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-base font-semibold mb-4">Perfil</h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <Input label="Nome" placeholder="Seu nome completo" />
            <Input label="Email" type="email" placeholder="seu@email.com.br" />
            <Button type="submit" size="sm">Salvar perfil</Button>
          </form>
        </section>

        {/* Theme section */}
        <section className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-base font-semibold mb-1">Tema</h2>
          <p className="text-sm text-muted-foreground mb-4">Escolha entre o tema claro ou escuro</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => theme === "dark" && toggleTheme()}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                theme === "light"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              <Sun size={16} />
              Claro
            </button>
            <button
              onClick={() => theme === "light" && toggleTheme()}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                theme === "dark"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              <Moon size={16} />
              Escuro
            </button>
          </div>
        </section>

        {/* Notifications section */}
        <section className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-base font-semibold mb-1">Notificações</h2>
          <p className="text-sm text-muted-foreground mb-4">Configure como deseja receber alertas</p>
          <div className="space-y-3">
            <ToggleRow label="Alertas por email" description="Receba avisos de orçamento e vencimentos por email" />
            <ToggleRow label="Telegram Bot" description="Receba notificações e gerencie finanças pelo Telegram" />
            <ToggleRow label="Alertas preditivos" description="Avisos quando você estiver no caminho de ultrapassar um orçamento" defaultOn />
          </div>
        </section>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  defaultOn = false,
}: {
  label: string;
  description: string;
  defaultOn?: boolean;
}) {
  const [enabled, setEnabled] = useState(defaultOn);

  return (
    <div className="flex items-start gap-4 py-3 border-b border-border last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => setEnabled(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          enabled ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
