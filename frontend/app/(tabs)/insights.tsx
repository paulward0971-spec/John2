// Insights — bar chart per day of the last 14 days,
// "X% lower than same period last month", budgets list + Create a budget.
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Svg, { Rect, Line } from "react-native-svg";
import { colors } from "@/src/theme";
import { api, formatEuros } from "@/src/api";

const DAYS = 14;

function buildSeries(txns: any[]) {
  const today = new Date();
  const cur: number[] = new Array(DAYS).fill(0);
  const prev: number[] = new Array(DAYS).fill(0);
  for (const t of txns) {
    if (t.status === "declined" || !t.amount_cents || t.amount_cents >= 0) continue;
    const d = new Date(t.date);
    const daysAgo = Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
    if (daysAgo >= 0 && daysAgo < DAYS) cur[DAYS - 1 - daysAgo] += Math.abs(t.amount_cents);
    else if (daysAgo >= DAYS && daysAgo < DAYS * 2) prev[DAYS * 2 - 1 - daysAgo] += Math.abs(t.amount_cents);
  }
  const curTotal = cur.reduce((a, b) => a + b, 0);
  const prevTotal = prev.reduce((a, b) => a + b, 0);
  const diffPct = prevTotal > 0 ? Math.round(((prevTotal - curTotal) / prevTotal) * 100) : 0;
  return { cur, prev, curTotal, prevTotal, diffPct };
}

export default function Insights() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const txns = useQuery({ queryKey: ["txns"], queryFn: api.listTransactions });
  const budgets = useQuery({ queryKey: ["budgets"], queryFn: api.listBudgets });
  const [openBudget, setOpenBudget] = useState(false);
  const [bName, setBName] = useState("");
  const [bCap, setBCap] = useState("");
  const [bCat, setBCat] = useState<string>("");

  const series = useMemo(() => buildSeries(txns.data || []), [txns.data]);
  const maxBar = Math.max(...series.cur, ...series.prev, 1);
  const barW = 20;
  const gap = 4;
  const chartW = DAYS * (barW + gap);
  const chartH = 140;

  const createBudget = async () => {
    if (!bName.trim() || !Number(bCap)) return;
    await api.createBudget({
      name: bName.trim(),
      monthly_cap_cents: Math.round(Number(bCap) * 100),
      categories: bCat.trim() ? bCat.split(",").map((s) => s.trim()) : [],
    });
    setBName(""); setBCap(""); setBCat("");
    setOpenBudget(false);
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top + 12 }} testID="insights-screen">
      <View style={{ paddingHorizontal: 20 }}>
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.sub}>Your spending, last 14 days</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {/* Total + comparison */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total spent</Text>
          <Text style={styles.totalValue}>{formatEuros(-series.curTotal)}</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              {series.diffPct >= 0
                ? `${series.diffPct}% lower than same period last month`
                : `${Math.abs(series.diffPct)}% higher than same period last month`}
            </Text>
          </View>
        </View>

        {/* Bar chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Daily spend</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 12 }}>
            <Svg width={chartW} height={chartH + 26}>
              {/* baseline */}
              <Line x1="0" y1={chartH} x2={chartW} y2={chartH} stroke="#1F1F1F" strokeWidth={1} />
              {series.cur.map((v, i) => {
                const h = (v / maxBar) * (chartH - 10);
                const x = i * (barW + gap);
                const prevH = (series.prev[i] / maxBar) * (chartH - 10);
                return (
                  <React.Fragment key={i}>
                    {/* Previous period ghost bar */}
                    <Rect x={x + 4} y={chartH - prevH} width={barW - 8} height={prevH} fill="#2A2A2A" rx={3} />
                    {/* Current period bar */}
                    <Rect x={x} y={chartH - h} width={barW} height={h} fill={colors.brandTertiary} rx={4} />
                  </React.Fragment>
                );
              })}
            </Svg>
          </ScrollView>
          <View style={styles.legend}>
            <View style={[styles.legendDot, { backgroundColor: colors.brandTertiary }]} />
            <Text style={styles.legendText}>This period</Text>
            <View style={[styles.legendDot, { backgroundColor: "#2A2A2A", marginLeft: 16 }]} />
            <Text style={styles.legendText}>Last month</Text>
          </View>
        </View>

        {/* Budgets */}
        <View style={styles.sectionHead}>
          <Text style={styles.section}>Budgets</Text>
          <Pressable onPress={() => setOpenBudget(true)} testID="create-budget">
            <Text style={styles.createLink}>+ Create a budget</Text>
          </Pressable>
        </View>

        {(budgets.data || []).length === 0 ? (
          <View style={styles.emptyBudget}>
            <Text style={styles.emptyBudgetTitle}>No budgets yet</Text>
            <Text style={styles.emptyBudgetBody}>Set a monthly spend cap and we'll track it against your live transactions.</Text>
            <Pressable style={styles.emptyBudgetBtn} onPress={() => setOpenBudget(true)}>
              <Text style={styles.emptyBudgetBtnText}>Create a budget</Text>
            </Pressable>
          </View>
        ) : (
          (budgets.data || []).map((b: any) => (
            <View key={b.id} style={styles.budgetCard} testID={`budget-${b.id}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={styles.budgetName}>{b.name}</Text>
                <Text style={styles.budgetAmt}>{formatEuros(-b.spent_cents)} / {formatEuros(-b.monthly_cap_cents)}</Text>
              </View>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${Math.round(b.percent * 100)}%`, backgroundColor: b.percent > 0.9 ? colors.error : colors.brandTertiary }]} />
              </View>
              {b.categories?.length > 0 && <Text style={styles.budgetCats}>{b.categories.join(", ")}</Text>}
            </View>
          ))
        )}
      </ScrollView>

      {/* Create budget modal */}
      <Modal visible={openBudget} transparent animationType="slide" onRequestClose={() => setOpenBudget(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpenBudget(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Create a budget</Text>
            <Text style={styles.sheetLabel}>Name</Text>
            <TextInput style={styles.input} placeholder="e.g. Groceries" placeholderTextColor={colors.muted} value={bName} onChangeText={setBName} testID="budget-name" />
            <Text style={styles.sheetLabel}>Monthly cap (EUR)</Text>
            <TextInput style={styles.input} placeholder="200" placeholderTextColor={colors.muted} value={bCap} onChangeText={setBCap} keyboardType="decimal-pad" testID="budget-cap" />
            <Text style={styles.sheetLabel}>Categories (comma-separated, optional)</Text>
            <TextInput style={styles.input} placeholder="groceries, entertainment" placeholderTextColor={colors.muted} value={bCat} onChangeText={setBCat} autoCapitalize="none" testID="budget-cats" />
            <Pressable style={styles.sheetBtn} onPress={createBudget} testID="budget-save">
              <Text style={styles.sheetBtnText}>Save budget</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: "#fff", fontSize: 32, fontWeight: "900" },
  sub: { color: colors.muted, marginTop: 4 },
  totalCard: { backgroundColor: "#111", borderRadius: 16, padding: 20, marginBottom: 16 },
  totalLabel: { color: colors.muted, fontSize: 13 },
  totalValue: { color: "#fff", fontSize: 32, fontWeight: "900", marginTop: 6 },
  pill: { alignSelf: "flex-start", marginTop: 10, backgroundColor: "rgba(76,175,80,0.15)", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  pillText: { color: colors.success, fontSize: 13, fontWeight: "800" },

  chartCard: { backgroundColor: "#111", borderRadius: 16, padding: 16, marginBottom: 20 },
  chartTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  legend: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { color: colors.muted, fontSize: 12, fontWeight: "700" },

  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, marginBottom: 12 },
  section: { color: "#fff", fontSize: 20, fontWeight: "900" },
  createLink: { color: colors.brandLight, fontSize: 14, fontWeight: "800" },

  emptyBudget: { backgroundColor: "#111", borderRadius: 16, padding: 20, alignItems: "center" },
  emptyBudgetTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  emptyBudgetBody: { color: colors.muted, fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 18 },
  emptyBudgetBtn: { marginTop: 16, backgroundColor: colors.brandPrimary, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999 },
  emptyBudgetBtnText: { color: "#fff", fontWeight: "800" },

  budgetCard: { backgroundColor: "#111", borderRadius: 16, padding: 16, marginBottom: 10 },
  budgetName: { color: "#fff", fontSize: 15, fontWeight: "800" },
  budgetAmt: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  bar: { height: 8, backgroundColor: "#222", borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  budgetCats: { color: colors.muted, fontSize: 12, marginTop: 8, textTransform: "capitalize" },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F0F0F", padding: 20, paddingBottom: 32, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#3D3D3D", alignSelf: "center", marginBottom: 16 },
  sheetTitle: { color: "#fff", fontSize: 20, fontWeight: "900", marginBottom: 12 },
  sheetLabel: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: "#161616", color: "#fff", padding: 14, borderRadius: 12, fontSize: 15, fontWeight: "600" },
  sheetBtn: { backgroundColor: colors.brandPrimary, padding: 14, borderRadius: 999, alignItems: "center", marginTop: 20 },
  sheetBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
