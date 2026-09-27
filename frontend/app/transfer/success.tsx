// Success screen — Transfer Successful + full receipt (matches your screenshots)
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useQueryClient } from "@tanstack/react-query";
import { colors } from "@/src/theme";
import { api, formatEuros, formatIban } from "@/src/api";
import { BankLogo } from "@/src/components/bank-logo";

export default function Success() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [t, setT] = useState<any>(null);

  useEffect(() => {
    (async () => setT(await api.getTransfer(id!)))();
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["txns"] });
    qc.invalidateQueries({ queryKey: ["payees"] });
  }, [id]);

  if (!t) return <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}><ActivityIndicator color={colors.brandTertiary} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }} testID="success-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <LinearGradient colors={["#4A0E5C", "#7B1FA2"]} style={styles.header}>
          <Text style={styles.brand}>AIB</Text>
          <Text style={styles.brandSub}>Transfer Confirmation</Text>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.tickWrap}>
            <View style={styles.tick}>
              <Text style={{ color: colors.success, fontSize: 34, fontWeight: "900" }}>✓</Text>
            </View>
          </View>
          <Text style={styles.title}>Transfer Successful</Text>
          <Text style={styles.subtitle}>Your SEPA transfer has been processed successfully</Text>

          <View style={styles.card}>
            <Row label="Reference" value={t.reference} />
            <Row label="Amount" value={formatEuros(t.amount_cents)} />
            <Row label="To" value={t.recipient_name} />
            <Row label="IBAN" value={formatIban(t.iban)} />
            <Row label="BIC Code" value={t.bic} />
            <Row label="Bank" value={t.bank_name} slug={t.bank_slug} />
            <Row label="Status" value="Complete" valueColor={colors.success} />
            <Row label="Processing Time" value="24 hours" last />
          </View>

          <View style={styles.info}>
            <Text style={styles.infoText}>
              <Text style={{ color: colors.info, fontWeight: "800" }}>SEPA Transfer: </Text>
              Transfers within the SEPA zone typically take 24 hours to complete.
            </Text>
          </View>
          <View style={styles.warn}>
            <Text style={styles.warnText}>
              <Text style={{ color: colors.error, fontWeight: "800" }}>Important: </Text>
              This payment cannot be cancelled once sent.
            </Text>
          </View>

          {t.email_sent ? (
            <Text style={styles.mailNote}>A receipt has been emailed to you.</Text>
          ) : (
            <Text style={styles.mailNoteMuted}>Add your email in Settings to receive email receipts.</Text>
          )}

          <View style={styles.actions}>
            <Pressable style={styles.primaryBtn} onPress={() => router.replace("/(tabs)")} testID="back-dash">
              <Text style={styles.primaryBtnText}>Back to Dashboard</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => router.replace("/transfer/new")} testID="new-transfer">
              <Text style={styles.secondaryBtnText}>New Transfer</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, valueColor, slug, last }: { label: string; value: string; valueColor?: string; slug?: string; last?: boolean }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {slug ? <BankLogo slug={slug} size={22} /> : null}
        <Text style={[styles.rowValue, valueColor && { color: valueColor }]} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingVertical: 20 },
  brand: { color: "#fff", fontSize: 26, fontWeight: "900", letterSpacing: 1 },
  brandSub: { color: "#EAD6F0", fontSize: 15, marginTop: 4 },
  body: { padding: 20 },
  tickWrap: { alignItems: "center", marginTop: 12 },
  tick: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(76,175,80,0.15)", alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 26, fontWeight: "900", textAlign: "center", marginTop: 12 },
  subtitle: { color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 6 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 16, marginTop: 20, padding: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border, gap: 12 },
  rowLabel: { color: colors.muted, fontSize: 13 },
  rowValue: { color: "#fff", fontSize: 14, fontWeight: "800", textAlign: "right", flexShrink: 1 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end" },
  info: { backgroundColor: "rgba(100,181,246,0.12)", borderLeftWidth: 3, borderLeftColor: colors.info, padding: 14, borderRadius: 10, marginTop: 16 },
  infoText: { color: "#B5D6F5", fontSize: 13, lineHeight: 18 },
  warn: { backgroundColor: "rgba(255,82,82,0.12)", borderLeftWidth: 3, borderLeftColor: colors.error, padding: 14, borderRadius: 10, marginTop: 10 },
  warnText: { color: "#F5B5B5", fontSize: 13, lineHeight: 18 },
  mailNote: { color: colors.success, marginTop: 12, fontSize: 13, fontWeight: "700", textAlign: "center" },
  mailNoteMuted: { color: colors.muted, marginTop: 12, fontSize: 12, textAlign: "center" },
  actions: { flexDirection: "row", gap: 10, marginTop: 20 },
  primaryBtn: { flex: 1, backgroundColor: colors.brandPrimary, padding: 16, borderRadius: 12, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  secondaryBtn: { flex: 1, backgroundColor: colors.surfaceSecondary, padding: 16, borderRadius: 12, alignItems: "center" },
  secondaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
