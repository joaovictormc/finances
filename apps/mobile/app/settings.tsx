import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Switch, ScrollView, ActivityIndicator, Platform, Share } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { api, API_URL, nativeAuthHeaders } from "@/lib/api-client";
import { authClient, useSession } from "@/lib/auth-client";
import { useTheme, type ThemeColors } from "@/lib/theme";
import { TelegramLink } from "@/components/telegram-link";
import { TwoFactorSection } from "@/components/two-factor-section";
import { ChangePasswordSection } from "@/components/change-password-section";
import { DeleteAccountSection } from "@/components/delete-account-section";
import type { NotificationPreferences, ReferralSummary } from "@/lib/types";

const CURRENT_YEAR = new Date().getFullYear();
const REPORT_YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { data: session } = useSession();

  const [reportYear, setReportYear] = useState(CURRENT_YEAR);
  const [downloading, setDownloading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [referralLink, setReferralLink] = useState("");
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loadingReferrals, setLoadingReferrals] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ code: string; link: string }>("/api/referrals/code"),
      api.get<ReferralSummary>("/api/referrals"),
    ])
      .then(([codeRes, summaryRes]) => {
        setReferralLink(codeRes.link);
        setSummary(summaryRes);
      })
      .catch(() => {})
      .finally(() => setLoadingReferrals(false));
  }, []);

  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name);
  }, [session?.user?.name]);

  async function handleSaveProfile() {
    if (!name.trim()) return;
    setProfileError(null);
    setSavingProfile(true);
    try {
      await authClient.updateUser({ name: name.trim() });
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Erro ao atualizar perfil.");
    } finally {
      setSavingProfile(false);
    }
  }

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
      // reverte silenciosamente se a chamada falhar; próximo GET corrige o estado
    }
  }

  async function handleCopyReferralLink() {
    if (!referralLink) return;
    await Clipboard.setStringAsync(referralLink);
  }

  async function handleShareReferralLink() {
    if (!referralLink) return;
    await Share.share({
      message: `Bora organizar as finanças? Se cadastra no ControlAI com meu link: ${referralLink}`,
    });
  }

  async function handleDownloadReport() {
    setReportError(null);
    setDownloading(true);
    try {
      const path = `/api/reports/annual?year=${reportYear}`;
      const filename = `relatorio-anual-${reportYear}.pdf`;

      if (Platform.OS === "web") {
        const res = await fetch(`${API_URL}${path}`, { credentials: "include" });
        if (!res.ok) throw new Error("Falha ao gerar relatório");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const dest = new File(Paths.cache, filename);
        await File.downloadFileAsync(`${API_URL}${path}`, dest, {
          headers: nativeAuthHeaders(),
          idempotent: true,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(dest.uri);
        }
      }
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Erro ao gerar relatório anual.");
    } finally {
      setDownloading(false);
    }
  }

  const [exportingData, setExportingData] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExportData() {
    setExportError(null);
    setExportingData(true);
    try {
      const path = "/api/user/export";
      const filename = `meus-dados-controlai-${new Date().toISOString().slice(0, 10)}.json`;

      if (Platform.OS === "web") {
        const res = await fetch(`${API_URL}${path}`, { credentials: "include" });
        if (!res.ok) throw new Error("Falha ao exportar dados");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const dest = new File(Paths.cache, filename);
        await File.downloadFileAsync(`${API_URL}${path}`, dest, {
          headers: nativeAuthHeaders(),
          idempotent: true,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(dest.uri);
        }
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Erro ao exportar seus dados.");
    } finally {
      setExportingData(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark" contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View className="rounded-2xl border border-border bg-card p-5 dark:border-border-dark dark:bg-card-dark">
        <Text className="mb-4 text-base font-semibold text-foreground dark:text-foreground-dark">Perfil</Text>

        <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Nome</Text>
        <TextInput
          className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
          value={name}
          onChangeText={setName}
          placeholder="Seu nome completo"
          placeholderTextColor={colors.mutedForeground}
        />

        <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">Email</Text>
        <TextInput
          className="mb-4 rounded-md border border-border bg-muted px-3 py-3 text-muted-foreground dark:border-border-dark dark:bg-muted-dark dark:text-muted-foreground-dark"
          value={session?.user?.email ?? ""}
          editable={false}
        />

        {profileError && (
          <Text className="mb-3 text-sm text-destructive dark:text-destructive-dark">{profileError}</Text>
        )}

        <Pressable
          onPress={handleSaveProfile}
          disabled={savingProfile}
          className="items-center rounded-md bg-primary py-3 dark:bg-primary-dark"
        >
          {savingProfile ? (
            <ActivityIndicator color="#14142B" />
          ) : (
            <Text className="text-sm font-medium text-primary-foreground dark:text-primary-foreground-dark">
              Salvar perfil
            </Text>
          )}
        </Pressable>
      </View>

      <View className="rounded-2xl border border-border bg-card p-5 dark:border-border-dark dark:bg-card-dark">
        <Text className="mb-1 text-base font-semibold text-foreground dark:text-foreground-dark">Segurança</Text>
        <Text className="mb-4 text-sm text-muted-foreground dark:text-muted-foreground-dark">
          Senha e autenticação em duas etapas
        </Text>
        <ChangePasswordSection />
        <View className="my-4 border-t border-border dark:border-border-dark" />
        <TwoFactorSection />
      </View>

      <View className="rounded-2xl border border-border bg-card p-5 dark:border-border-dark dark:bg-card-dark">
        <Text className="mb-1 text-base font-semibold text-foreground dark:text-foreground-dark">Telegram</Text>
        <Text className="mb-4 text-sm text-muted-foreground dark:text-muted-foreground-dark">
          Vincule sua conta ao bot pra registrar gastos e receber notificações pelo Telegram.
        </Text>
        <TelegramLink />
      </View>

      <View className="rounded-2xl border border-border bg-card p-5 dark:border-border-dark dark:bg-card-dark">
        <Text className="mb-1 text-base font-semibold text-foreground dark:text-foreground-dark">Notificações</Text>
        <Text className="mb-4 text-sm text-muted-foreground dark:text-muted-foreground-dark">
          Configure como deseja receber alertas.
        </Text>

        <NotificationRow
          label="Alertas por email"
          description="Receba avisos de orçamento e vencimentos por email"
          value={prefs?.notifyEmail ?? true}
          onChange={(v) => updatePref("notifyEmail", v)}
          colors={colors}
        />
        <NotificationRow
          label="Telegram Bot"
          description="Receba notificações e gerencie finanças pelo Telegram"
          value={prefs?.notifyTelegram ?? true}
          onChange={(v) => updatePref("notifyTelegram", v)}
          colors={colors}
        />
        <NotificationRow
          label="Alertas preditivos"
          description="Avisos quando você estiver no caminho de ultrapassar um orçamento"
          value={prefs?.aiInsightsEnabled ?? true}
          onChange={(v) => updatePref("aiInsightsEnabled", v)}
          colors={colors}
          last
        />
      </View>

      <View className="rounded-2xl border border-border bg-card p-5 dark:border-border-dark dark:bg-card-dark">
        <Text className="mb-1 text-base font-semibold text-foreground dark:text-foreground-dark">Relatório anual</Text>
        <Text className="mb-4 text-sm text-muted-foreground dark:text-muted-foreground-dark">
          Baixe um PDF com o resumo mensal e as principais categorias de gasto do ano escolhido.
        </Text>

        <View className="mb-4 flex-row gap-2">
          {REPORT_YEARS.map((y) => (
            <Pressable
              key={y}
              onPress={() => setReportYear(y)}
              className={`rounded-full border px-3 py-1.5 ${reportYear === y ? "border-primary bg-primary/10 dark:border-primary-dark" : "border-border dark:border-border-dark"}`}
            >
              <Text className="text-xs font-medium text-foreground dark:text-foreground-dark">{y}</Text>
            </Pressable>
          ))}
        </View>

        {reportError && <Text className="mb-3 text-sm text-destructive dark:text-destructive-dark">{reportError}</Text>}

        <Pressable
          onPress={handleDownloadReport}
          disabled={downloading}
          className="flex-row items-center justify-center gap-2 rounded-md bg-primary py-3 dark:bg-primary-dark"
        >
          {downloading ? (
            <ActivityIndicator color="#14142B" />
          ) : (
            <>
              <Ionicons name="download-outline" size={16} color="#14142B" />
              <Text className="text-sm font-medium text-primary-foreground dark:text-primary-foreground-dark">
                Baixar PDF
              </Text>
            </>
          )}
        </Pressable>
      </View>

      <View className="rounded-2xl border border-border bg-card p-5 dark:border-border-dark dark:bg-card-dark">
        <View className="mb-1 flex-row items-center gap-2">
          <Ionicons name="gift-outline" size={16} color={colors.primary} />
          <Text className="text-base font-semibold text-foreground dark:text-foreground-dark">Indique e ganhe</Text>
        </View>
        <Text className="mb-4 text-sm text-muted-foreground dark:text-muted-foreground-dark">
          Compartilhe seu link. Quando a pessoa indicada assinar um plano pago, você ganha 30 dias grátis.
        </Text>

        {loadingReferrals ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            {referralLink && (
              <View className="mb-3 rounded-md border border-border bg-muted p-3 dark:border-border-dark dark:bg-muted-dark">
                <Text className="text-xs text-foreground dark:text-foreground-dark" numberOfLines={1}>
                  {referralLink}
                </Text>
              </View>
            )}

            <View className="mb-4 flex-row gap-2">
              <Pressable
                onPress={handleCopyReferralLink}
                className="flex-1 items-center rounded-md border border-primary py-3 dark:border-primary-dark"
              >
                <Text className="text-sm font-medium text-primary dark:text-primary-dark">Copiar</Text>
              </Pressable>
              <Pressable
                onPress={handleShareReferralLink}
                className="flex-1 items-center rounded-md bg-primary py-3 dark:bg-primary-dark"
              >
                <Text className="text-sm font-medium text-primary-foreground dark:text-primary-foreground-dark">
                  Compartilhar
                </Text>
              </Pressable>
            </View>

            {summary && summary.total > 0 && (
              <View>
                <Text className="mb-2 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                  {summary.total} indicação{summary.total > 1 ? "ões" : ""} · {summary.rewardsGranted} recompensa
                  {summary.rewardsGranted !== 1 ? "s" : ""} concedida{summary.rewardsGranted !== 1 ? "s" : ""}
                </Text>
                {summary.referrals.map((r) => (
                  <View
                    key={r.id}
                    className="flex-row items-center justify-between border-b border-border py-2 last:border-0 dark:border-border-dark"
                  >
                    <Text className="text-sm text-foreground dark:text-foreground-dark">{r.referredName}</Text>
                    <Text
                      className={`text-xs ${r.rewardGranted ? "text-green-600" : "text-muted-foreground dark:text-muted-foreground-dark"}`}
                    >
                      {r.rewardGranted ? "Recompensa concedida" : "Aguardando assinatura"}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>

      <View className="rounded-2xl border border-border bg-card p-5 dark:border-border-dark dark:bg-card-dark">
        <Text className="mb-1 text-base font-semibold text-foreground dark:text-foreground-dark">Meus dados</Text>
        <Text className="mb-4 text-sm text-muted-foreground dark:text-muted-foreground-dark">
          Baixe uma cópia de todos os seus dados ou exclua sua conta permanentemente.
        </Text>

        {exportError && (
          <Text className="mb-3 text-sm text-destructive dark:text-destructive-dark">{exportError}</Text>
        )}

        <Pressable
          onPress={handleExportData}
          disabled={exportingData}
          className="mb-4 flex-row items-center justify-center gap-2 rounded-md border border-border py-3 dark:border-border-dark"
        >
          {exportingData ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Ionicons name="download-outline" size={16} color={colors.foreground} />
              <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">
                Baixar meus dados (JSON)
              </Text>
            </>
          )}
        </Pressable>

        <View className="border-t border-border pt-4 dark:border-border-dark">
          <DeleteAccountSection />
        </View>
      </View>
    </ScrollView>
  );
}

function NotificationRow({
  label,
  description,
  value,
  onChange,
  colors,
  last = false,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  colors: ThemeColors;
  last?: boolean;
}) {
  return (
    <View className={`flex-row items-center gap-3 py-3 ${last ? "" : "border-b border-border dark:border-border-dark"}`}>
      <View className="flex-1">
        <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">{label}</Text>
        <Text className="mt-0.5 text-xs text-muted-foreground dark:text-muted-foreground-dark">{description}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}
