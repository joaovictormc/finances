import type { ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";

// Tab bar no estilo do design "Finans": barra inferior com um FAB central
// amarelo elevado (abre "Nova transação"). Item ativo em navy, inativos em
// cinza-azulado. Tipagem estrutural dos props pra não depender de pacote
// transitivo (@react-navigation/bottom-tabs) — ver apps/mobile/AGENTS.md.
type TabIconRenderer = (p: { focused: boolean; color: string; size: number }) => ReactNode;

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string; tabBarIcon?: TabIconRenderer } }>;
  navigation: {
    navigate: (name: string) => void;
    emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
  };
};

const FAB_SIZE = 60;

export function FinansTabBar({ state, descriptors, navigation }: TabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  function renderTab(route: { key: string; name: string }, index: number) {
    const { options } = descriptors[route.key];
    const focused = state.index === index;
    const color = focused ? colors.foreground : colors.tabInactive;
    const label = options.title ?? route.name;

    const onPress = () => {
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        className="flex-1 items-center justify-center gap-1 py-2"
      >
        {options.tabBarIcon?.({ focused, color, size: 24 })}
        <Text style={{ color }} className="text-[11px] font-medium">
          {label}
        </Text>
      </Pressable>
    );
  }

  // 4 abas: [0][1] · FAB · [2][3]
  const left = state.routes.slice(0, 2);
  const right = state.routes.slice(2);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.card,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        paddingBottom: insets.bottom,
        height: 60 + insets.bottom,
        overflow: "visible",
      }}
    >
      {left.map((r) => renderTab(r, state.routes.indexOf(r)))}

      {/* slot central que ancora o FAB elevado */}
      <View style={{ width: 72, alignItems: "center", justifyContent: "center" }}>
        <Pressable
          onPress={() => router.push("/new-transaction")}
          accessibilityRole="button"
          accessibilityLabel="Nova transação"
          style={{
            position: "absolute",
            top: -FAB_SIZE / 2,
            width: FAB_SIZE,
            height: FAB_SIZE,
            borderRadius: FAB_SIZE / 2,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: colors.primary,
            shadowOpacity: 0.45,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          }}
        >
          <Ionicons name="add" size={32} color="#14142B" />
        </Pressable>
      </View>

      {right.map((r) => renderTab(r, state.routes.indexOf(r)))}
    </View>
  );
}
