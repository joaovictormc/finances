import { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { api } from "@/lib/api-client";
import { IconBadge } from "@/components/icon-badge";
import { formatBRL, formatDate, daysUntil } from "@/lib/format";
import type { RecurringBill } from "@/lib/types";

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: "Mensal",
  weekly: "Semanal",
  annual: "Anual",
  custom: "Personalizado",
};

type BadgeTone = "destructive" | "warning" | "neutral";

const TONE: Record<BadgeTone, { box: string; text: string }> = {
  destructive: { box: "bg-destructive/15", text: "text-destructive dark:text-destructive-dark" },
  warning: { box: "bg-amber-500/15", text: "text-amber-600 dark:text-amber-400" },
  neutral: { box: "bg-muted dark:bg-muted-dark", text: "text-muted-foreground dark:text-muted-foreground-dark" },
};

function Badge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <View className={`rounded-full px-2 py-0.5 ${TONE[tone].box}`}>
      <Text className={`text-[11px] font-medium ${TONE[tone].text}`}>{label}</Text>
    </View>
  );
}

function dueBadge(bill: RecurringBill): { label: string; tone: BadgeTone } | null {
  if (!bill.nextDueDate) return null;
  const days = daysUntil(bill.nextDueDate);
  if (days < 0) return { label: "Vencida", tone: "destructive" };
  if (days <= 3) return { label: `Vence em ${days}d`, tone: "warning" };
  if (days <= 7) return { label: `Em ${days} dias`, tone: "neutral" };
  return null;
}

export default function BillsScreen() {
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      api
        .get<RecurringBill[]>("/api/bills")
        .then(setBills)
        .finally(() => setLoading(false));
    }, [])
  );

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <View className="flex-row justify-end p-4">
        <Pressable
          onPress={() => router.push("/new-bill")}
          className="rounded-md bg-primary px-3 py-2 dark:bg-primary-dark"
        >
          <Text className="text-sm font-medium text-primary-foreground dark:text-primary-foreground-dark">
            + Nova Conta
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={bills}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12 }}
          ListEmptyComponent={
            <Text className="p-6 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
              Nenhuma conta recorrente cadastrada.
            </Text>
          }
          renderItem={({ item: b }) => {
            const badge = dueBadge(b);
            return (
              <Pressable
                onPress={() => router.push({ pathname: "/edit-bill", params: { id: b.id } })}
                className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4 dark:border-border-dark dark:bg-card-dark"
              >
                <IconBadge icon={b.category?.icon ?? "📄"} />
                <View className="flex-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="font-semibold text-foreground dark:text-foreground-dark">{b.name}</Text>
                    {badge && <Badge label={badge.label} tone={badge.tone} />}
                    {!b.isActive && <Badge label="Inativa" tone="neutral" />}
                  </View>
                  <Text className="mt-0.5 text-xs text-muted-foreground dark:text-muted-foreground-dark">
                    {FREQUENCY_LABELS[b.frequency] ?? b.frequency}
                    {b.dayOfMonth ? ` · Todo dia ${b.dayOfMonth}` : ""}
                    {b.nextDueDate ? ` · Próximo: ${formatDate(b.nextDueDate)}` : ""}
                  </Text>
                </View>
                <Text className="text-right text-sm font-semibold text-foreground dark:text-foreground-dark">
                  {b.expectedAmount ? formatBRL(b.expectedAmount) : "Variável"}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
