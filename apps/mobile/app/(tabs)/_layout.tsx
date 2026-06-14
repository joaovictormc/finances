import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#000",
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Visão Geral", tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="transactions"
        options={{ title: "Transações", tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="budgets"
        options={{ title: "Orçamentos", tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Perfil", tabBarIcon: () => null }}
      />
    </Tabs>
  );
}
