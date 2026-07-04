"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sun, Moon, ArrowRight, CreditCard, FileDown } from "lucide-react";
import { useTheme } from "@/app/providers/theme-provider";
import { authClient, useSession } from "@/lib/auth-client";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-provider";
import { ReferralSection } from "@/components/settings/referral-section";
import { TwoFactorSection } from "@/components/settings/two-factor-section";
import { TelegramLink } from "@/components/bot/telegram-link";
import type { NotificationPreferences } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const CURRENT_YEAR = new Date().getFullYear();
const REPORT_YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const { data: session } = useSession();
  const [reportYear, setReportYear] = useState(String(CURRENT_YEAR));
  const [isDownloading, setIsDownloading] = useState(false);

  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name);
  }, [session?.user?.name]);

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    api
      .get<NotificationPreferences>("/api/settings/notifications")
      .then(setPrefs)
      .catch(() => {});
  }, []);

  async function updatePref(key: keyof NotificationPreferences, value: boolean) {
    setPrefs((prev) => (prev ? { ...prev, [key]: value } : prev));
    try {
      await api.patch<NotificationPreferences>("/api/settings/notifications", { [key]: value });
    } catch {
      toast({ title: "Erro ao salvar preferência", variant: "error" });
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSavingProfile(true);
    try {
      await authClient.updateUser({ name: name.trim() });
      toast({ title: "Perfil atualizado!", variant: "success" });
    } catch (err) {
      toast({
        title: "Erro ao atualizar perfil",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDownloadReport = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch(`${API_URL}/api/reports/annual?year=${reportYear}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao gerar relatório");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-anual-${reportYear}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Erro ao gerar relatório anual", variant: "error" });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie suas preferências pessoais</p>
      </div>

      <div className="space-y-6">
        {/* Billing section */}
        <Link
          href="/settings/billing"
          className="flex items-center gap-4 bg-card rounded-2xl border border-border/60 shadow-sm p-6 hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15 text-primary shrink-0">
            <CreditCard size={18} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">Planos e Assinatura</h2>
            <p className="text-sm text-muted-foreground">Gerencie seu plano, upgrade ou cancelamento</p>
          </div>
          <ArrowRight size={16} className="text-muted-foreground shrink-0" />
        </Link>

        {/* Profile section */}
        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-4">Perfil</h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <Input
              label="Nome"
              placeholder="Seu nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              value={session?.user?.email ?? ""}
              disabled
              title="O email não pode ser alterado por aqui"
            />
            <Button type="submit" size="sm" loading={savingProfile}>Salvar perfil</Button>
          </form>
        </section>

        {/* Security section */}
        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1">Segurança</h2>
          <p className="text-sm text-muted-foreground mb-4">Autenticação em duas etapas (2FA)</p>
          <TwoFactorSection />
        </section>

        {/* Theme section */}
        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1">Tema</h2>
          <p className="text-sm text-muted-foreground mb-4">Escolha entre o tema claro ou escuro</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => theme === "dark" && toggleTheme()}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                theme === "light"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              <Sun size={16} />
              Claro
            </button>
            <button
              onClick={() => theme === "light" && toggleTheme()}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                theme === "dark"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              <Moon size={16} />
              Escuro
            </button>
          </div>
        </section>

        {/* Annual report section */}
        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1">Relatório anual</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Baixe um PDF com o resumo mensal e as principais categorias de gasto do ano escolhido
          </p>
          <div className="flex items-end gap-3">
            <Select
              label="Ano"
              value={reportYear}
              onChange={(e) => setReportYear(e.target.value)}
              options={REPORT_YEARS.map((y) => ({ value: String(y), label: String(y) }))}
              className="w-32"
            />
            <Button onClick={handleDownloadReport} loading={isDownloading} size="sm">
              <FileDown size={16} />
              Baixar PDF
            </Button>
          </div>
        </section>

        <ReferralSection />

        {/* Telegram section */}
        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1">Telegram</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Vincule sua conta ao bot pra registrar gastos e receber notificações pelo Telegram
          </p>
          <TelegramLink />
        </section>

        {/* Notifications section */}
        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1">Notificações</h2>
          <p className="text-sm text-muted-foreground mb-4">Configure como deseja receber alertas</p>
          <div className="space-y-3">
            <ToggleRow
              label="Alertas por email"
              description="Receba avisos de orçamento e vencimentos por email"
              enabled={prefs?.notifyEmail ?? true}
              onToggle={(v) => updatePref("notifyEmail", v)}
            />
            <ToggleRow
              label="Telegram Bot"
              description="Receba notificações e gerencie finanças pelo Telegram"
              enabled={prefs?.notifyTelegram ?? true}
              onToggle={(v) => updatePref("notifyTelegram", v)}
            />
            <ToggleRow
              label="Alertas preditivos"
              description="Avisos quando você estiver no caminho de ultrapassar um orçamento"
              enabled={prefs?.aiInsightsEnabled ?? true}
              onToggle={(v) => updatePref("aiInsightsEnabled", v)}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-border last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onToggle(!enabled)}
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
