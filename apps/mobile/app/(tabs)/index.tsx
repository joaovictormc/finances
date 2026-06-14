import { View, Text, StyleSheet, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";

export default function OverviewScreen() {
  return (
    <ScrollView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Visão Geral</Text>
        <Text style={styles.subtitle}>
          {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </Text>
      </View>

      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { borderLeftColor: "#22c55e" }]}>
          <Text style={styles.kpiLabel}>Receitas</Text>
          <Text style={[styles.kpiValue, { color: "#22c55e" }]}>R$ 0,00</Text>
        </View>
        <View style={[styles.kpiCard, { borderLeftColor: "#ef4444" }]}>
          <Text style={styles.kpiLabel}>Gastos</Text>
          <Text style={[styles.kpiValue, { color: "#ef4444" }]}>R$ 0,00</Text>
        </View>
      </View>

      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>Nenhuma transação</Text>
        <Text style={styles.emptyText}>
          Adicione transações ou conecte sua conta bancária
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: { padding: 20, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: "700", color: "#111" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  kpiRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20, marginTop: 8 },
  kpiCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiLabel: { fontSize: 12, color: "#6b7280" },
  kpiValue: { fontSize: 20, fontWeight: "700", marginTop: 4 },
  emptyState: {
    margin: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "600", marginTop: 12, color: "#111" },
  emptyText: { fontSize: 13, color: "#6b7280", textAlign: "center", marginTop: 6 },
});
