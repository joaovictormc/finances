import * as React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#13131a" },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 11, color: "#666", marginBottom: 20 },
  summaryRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  summaryCard: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: "#f4f4f6" },
  summaryLabel: { fontSize: 9, color: "#666", marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: 700 },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginTop: 8, marginBottom: 8 },
  table: { borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e4e4e7" },
  tableRowLast: { flexDirection: "row" },
  tableHeaderCell: { flex: 1, padding: 6, fontSize: 9, fontWeight: 700, backgroundColor: "#f4f4f6" },
  tableCell: { flex: 1, padding: 6, fontSize: 9 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#999", textAlign: "center" },
});

export interface MonthlyTotal {
  month: number;
  income: number;
  expense: number;
}

export interface CategoryTotal {
  name: string;
  total: number;
  percentage: number;
}

export interface AnnualReportProps {
  userName: string;
  year: number;
  monthlyTotals: MonthlyTotal[];
  topCategories: CategoryTotal[];
  totalIncome: number;
  totalExpense: number;
}

export function AnnualReportDocument({
  userName,
  year,
  monthlyTotals,
  topCategories,
  totalIncome,
  totalExpense,
}: AnnualReportProps) {
  const balance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Relatório Anual {year}</Text>
        <Text style={styles.subtitle}>{userName}</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Receitas no ano</Text>
            <Text style={styles.summaryValue}>{formatBRL(totalIncome)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Gastos no ano</Text>
            <Text style={styles.summaryValue}>{formatBRL(totalExpense)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Saldo</Text>
            <Text style={styles.summaryValue}>{formatBRL(balance)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Taxa de poupança</Text>
            <Text style={styles.summaryValue}>{savingsRate.toFixed(1)}%</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Resumo mensal</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableHeaderCell}>Mês</Text>
            <Text style={styles.tableHeaderCell}>Receitas</Text>
            <Text style={styles.tableHeaderCell}>Gastos</Text>
            <Text style={styles.tableHeaderCell}>Saldo</Text>
          </View>
          {monthlyTotals.map((m, i) => (
            <View
              key={m.month}
              style={i === monthlyTotals.length - 1 ? styles.tableRowLast : styles.tableRow}
            >
              <Text style={styles.tableCell}>{MONTH_NAMES[m.month - 1]}</Text>
              <Text style={styles.tableCell}>{formatBRL(m.income)}</Text>
              <Text style={styles.tableCell}>{formatBRL(m.expense)}</Text>
              <Text style={styles.tableCell}>{formatBRL(m.income - m.expense)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Top categorias de gasto</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableHeaderCell}>Categoria</Text>
            <Text style={styles.tableHeaderCell}>Total</Text>
            <Text style={styles.tableHeaderCell}>% do total de gastos</Text>
          </View>
          {topCategories.map((cat, i) => (
            <View
              key={cat.name}
              style={i === topCategories.length - 1 ? styles.tableRowLast : styles.tableRow}
            >
              <Text style={styles.tableCell}>{cat.name}</Text>
              <Text style={styles.tableCell}>{formatBRL(cat.total)}</Text>
              <Text style={styles.tableCell}>{cat.percentage.toFixed(1)}%</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>Gerado automaticamente • Finances</Text>
      </Page>
    </Document>
  );
}
