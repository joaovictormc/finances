import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FinansTabBar } from "@/components/finans-tab-bar";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FinansTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="index"
        options={{
          // "Início" e não "Visão Geral": com 6 abas cada uma fica com ~48px,
          // e o nome longo truncaria. Mesmo rótulo já usado na navegação
          // mobile da web (mobile-bottom-nav.tsx).
          title: "Início",
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: "Orçamentos",
          tabBarIcon: ({ color, size }) => <Ionicons name="pie-chart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transações",
          tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: "Contas",
          tabBarIcon: ({ color, size }) => <Ionicons name="card-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          // Rótulo curto: com 5 abas cada uma fica com ~48px de largura, e
          // "Assistente" truncaria. O ícone de balão dá o resto do contexto.
          title: "IA",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Mais",
          tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal-circle-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
