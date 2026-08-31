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

  // Com 5+ abas, cada uma cai de ~72px para ~48px numa tela de 360px e os
  // rótulos de 10 caracteres ("Transações", "Orçamentos") não cabem a 11px.
  const labelSize = state.routes.length > 4 ? 10 : 11;

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
        <Text style={{ color, fontSize: labelSize }} numberOfLines={1} className="font-medium">
          {label}
        </Text>
      </Pressable>
    );
  }

  // Duas metades em torno do FAB: [0][1] · FAB · [resto].
  // Cada metade é um container `flex: 1` próprio, e não itens `flex: 1` soltos
  // numa linha única — senão, com número ímpar de abas de cada lado, o FAB sai
  // do centro da tela e os itens da esquerda ficam mais largos que os da direita.
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
      <View style={{ flex: 1, flexDirection: "row" }}>
        {left.map((r) => renderTab(r, state.routes.indexOf(r)))}
      </View>

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
            // Sombra estrutural neutra (indica o FAB fixo/sobreposto), não um
            // halo decorativo na cor do marcador — ver DESIGN.md, Flat Ledger Rule.
            shadowColor: "#000000",
            shadowOpacity: 0.2,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          }}
        >
          <Ionicons name="add" size={32} color="#1C1C1E" />
        </Pressable>
      </View>

      <View style={{ flex: 1, flexDirection: "row" }}>
        {right.map((r) => renderTab(r, state.routes.indexOf(r)))}
      </View>
    </View>
  );
}
