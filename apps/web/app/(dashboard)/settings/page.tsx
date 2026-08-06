"use client";

import Link from "next/link";
import { ArrowRight, CreditCard } from "lucide-react";
import { ProfileSection } from "@/components/settings/profile-section";
import { ThemeSection } from "@/components/settings/theme-section";
import { AnnualReportSection } from "@/components/settings/annual-report-section";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { DataExportSection } from "@/components/settings/data-export-section";
import { ReferralSection } from "@/components/settings/referral-section";
import { TwoFactorSection } from "@/components/settings/two-factor-section";
import { ChangePasswordSection } from "@/components/settings/change-password-section";
import { TelegramLink } from "@/components/bot/telegram-link";

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie suas preferências pessoais</p>
      </div>

      <div className="space-y-6">
        {/* Billing section */}
        <Link
          href="/settings/billing"
          className="flex items-center gap-4 bg-card rounded-2xl border border-border/60 shadow-sm p-6 hover:border-foreground/30 transition-colors"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted text-muted-foreground shrink-0">
            <CreditCard size={18} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">Planos e Assinatura</h2>
            <p className="text-sm text-muted-foreground">Gerencie seu plano, upgrade ou cancelamento</p>
          </div>
          <ArrowRight size={16} className="text-muted-foreground shrink-0" />
        </Link>

        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-4">Perfil</h2>
          <ProfileSection />
        </section>

        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1">Segurança</h2>
          <p className="text-sm text-muted-foreground mb-4">Senha e autenticação em duas etapas</p>
          <div className="space-y-6">
            <ChangePasswordSection />
            <div className="border-t border-border pt-4">
              <TwoFactorSection />
            </div>
          </div>
        </section>

        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1">Tema</h2>
          <p className="text-sm text-muted-foreground mb-4">Escolha entre claro, escuro ou seguir o sistema</p>
          <ThemeSection />
        </section>

        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1">Relatório anual</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Baixe um PDF com o resumo mensal e as principais categorias de gasto do ano escolhido
          </p>
          <AnnualReportSection />
        </section>

        <ReferralSection />

        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1">Telegram</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Vincule sua conta ao bot pra registrar gastos e receber notificações pelo Telegram
          </p>
          <TelegramLink />
        </section>

        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1">Notificações</h2>
          <p className="text-sm text-muted-foreground mb-4">Configure como deseja receber alertas</p>
          <NotificationsSection />
        </section>

        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-base font-semibold mb-1">Meus dados</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Baixe uma cópia de todos os seus dados ou exclua sua conta permanentemente
          </p>
          <DataExportSection />
        </section>
      </div>
    </div>
  );
}
