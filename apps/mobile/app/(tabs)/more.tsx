import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { signOut } from "@/lib/auth-client";
import { Screen } from "@/components/screen";
import { useTheme, type ThemePreference } from "@/lib/theme";

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "light", label: "Claro", icon: "sunny-outline" },
  { value: "dark", label: "Escuro", icon: "moon-outline" },
  { value: "system", label: "Sistema", icon: "phone-portrait-outline" },
];

const MENU_ITEMS: {
  href: "/bills" | "/goals" | "/budgets" | "/groups" | "/billing" | "/settings";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { href: "/budgets", label: "Orçamentos", icon: "pie-chart-outline" },
  { href: "/bills", label: "Contas a Pagar", icon: "receipt-outline" },
  { href: "/goals", label: "Metas", icon: "flag-outline" },
  { href: "/groups", label: "Grupos", icon: "people-outline" },
  { href: "/billing", label: "Planos e Assinatura", icon: "card-outline" },
  { href: "/settings", label: "Configurações", icon: "settings-outline" },
];

export default function MoreScreen() {
  const { preference, setPreference, colors } = useTheme();

  return (
    <Screen>
      <View className="border-b border-border p-4 dark:border-border-dark">
        <Text className="text-2xl font-bold text-foreground dark:text-foreground-dark">Mais</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View className="mb-4 overflow-hidden rounded-xl border border-border dark:border-border-dark">
          {MENU_ITEMS.map((item, idx) => (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href)}
              className={`flex-row items-center justify-between bg-card px-4 py-3 dark:bg-card-dark ${
                idx > 0 ? "border-t border-border dark:border-border-dark" : ""
              }`}
            >
              <View className="flex-row items-center gap-3">
                <Ionicons name={item.icon} size={20} color={colors.foreground} />
                <Text className="text-base text-foreground dark:text-foreground-dark">{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>

        <Text className="mb-2 text-sm font-medium text-muted-foreground dark:text-muted-foreground-dark">
          Tema
        </Text>
        <View className="mb-6 overflow-hidden rounded-xl border border-border dark:border-border-dark">
          {THEME_OPTIONS.map((opt, idx) => {
            const selected = preference === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setPreference(opt.value)}
                className={`flex-row items-center justify-between bg-card px-4 py-3 dark:bg-card-dark ${
                  idx > 0 ? "border-t border-border dark:border-border-dark" : ""
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <Ionicons name={opt.icon} size={20} color={colors.foreground} />
                  <Text className="text-base text-foreground dark:text-foreground-dark">{opt.label}</Text>
                </View>
                {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => signOut()}
          className="flex-row items-center justify-center gap-2 rounded-xl border border-border py-3 dark:border-border-dark"
        >
          <Ionicons name="log-out-outline" size={18} color="#ef4444" />
          <Text className="text-sm font-medium text-destructive dark:text-destructive-dark">Sair</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
