// Transaction detail — matches AIB "Transaction details" layout exactly:
// centered title with back button, big hero card (avatar, name, date, amount),
// then a "Transaction details" list card with Account, Currency, Reference,
// AIB Payment Fee, Transaction type, Payment type, Status, dates.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle } from "react-native-svg";
import { colors } from "@/src/theme";
import { api, formatEuros } from "@/src/api";

function BackChev() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 L8 12 L15 19" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
function InfoDot() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={colors.brandTertiary} strokeWidth={1.6} fill="none" />
      <Circle cx="12" cy="8" r="1" fill={colors.brandTertiary} />
      <Path d="M12 11 V17" stroke={colors.brandTertiary} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export default function TxnDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [t, setT] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    (async () => {
      setT(await api.getTransaction(id!));
      setProfile(await api.getProfile());
    })();
  }, [id]);

  if (!t || !profile) {
    return <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center" }}><ActivityIndicator color={colors.brandTertiary} /></View>;
  }

  const d = new Date(t.date);
  const timeStr = d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", hour12: false });
  const dateStr = d.toLocaleDateString("en-IE", { day: "2-digit", month: "long", year: "numeric" });
  const creditValueDate = new Date(d.getTime() - 24 * 60 * 60 * 1000)
    .toLocaleDateString("en-IE", { day: "2-digit", month: "long", year: "numeric" });

  const initials = (t.merchant || "?")
    .split(/\s+/).map((s: string) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const isCredit = t.amount_cents > 0;
  const isDeclined = t.status === "declined";
  const paymentType = t.category === "transfer" ? "SEPA Instant" : "Card payment";
  const txnType = t.category === "transfer" ? "Transfer" : isCredit ? "Credit" : "Debit";
  const accountNumber = profile.account_number || "17012345";

  return (
    <View style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top + 8 }} testID="txn-detail">
      {/* Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="txn-back">
          <BackChev />
        </Pressable>
        <Text style={styles.topTitle}>Transaction details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Hero card */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{t.merchant}</Text>
          <Text style={styles.subDate}>{timeStr} • {dateStr}</Text>
          <Text
            style={[
              styles.amount,
              isCredit && { color: colors.success },
              isDeclined && { textDecorationLine: "line-through", opacity: 0.7 },
            ]}
          >
            {formatEuros(t.amount_cents)}
          </Text>
          {isDeclined && <Text style={styles.declined}>Declined</Text>}
        </View>

        {/* Section title */}
        <Text style={styles.section}>Transaction details</Text>

        {/* Details card */}
        <View style={styles.card}>
          <Row label="Account" value={accountNumber} />
          <Row label="Currency" value="EUR" />
          <RowStacked label="Reference number" value={t.reference || t.id} />
          <Row label="AIB Payment Fee" value="€0.00" valueColor={colors.brandTertiary} withInfo />
          <Row label="Transaction type" value={txnType} />
          <Row label="Payment type" value={paymentType} />
          <Row label="Status" value={isDeclined ? "Declined" : "Completed"} valueColor={isDeclined ? colors.error : "#fff"} />
          <Row label="Transaction date" value={dateStr} />
          <Row label="Credit value date" value={creditValueDate} last />
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, valueColor, withInfo, last }: { label: string; value: string; valueColor?: string; withInfo?: boolean; last?: boolean }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" }}>
        <Text style={[styles.rowValue, valueColor && { color: valueColor }]} numberOfLines={1}>{value}</Text>
        {withInfo && <InfoDot />}
      </View>
    </View>
  );
}

function RowStacked({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.rowStacked, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValueStacked}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center" },
  topTitle: { color: "#fff", fontSize: 18, fontWeight: "800", flex: 1, textAlign: "center" },

  hero: { backgroundColor: "#161616", borderRadius: 18, padding: 20, alignItems: "center", marginTop: 24 },
  avatar: {
    width: 68, height: 68, borderRadius: 16, backgroundColor: colors.brandDeep,
    alignItems: "center", justifyContent: "center",
    position: "absolute", top: -34, alignSelf: "center",
  },
  avatarText: { color: "#fff", fontSize: 22, fontWeight: "900" },
  name: { color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 40 },
  subDate: { color: colors.muted, fontSize: 15, marginTop: 8 },
  amount: { color: "#fff", fontSize: 40, fontWeight: "900", marginTop: 8 },
  declined: { color: colors.error, marginTop: 4, fontWeight: "800" },

  section: { color: "#fff", fontSize: 22, fontWeight: "900", marginTop: 24, marginBottom: 12 },
  card: { backgroundColor: "#111", borderRadius: 16, paddingHorizontal: 16 },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 18, borderBottomWidth: 0.5, borderBottomColor: "#1F1F1F", gap: 12,
  },
  rowStacked: {
    paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: "#1F1F1F",
  },
  rowLabel: { color: colors.muted, fontSize: 15 },
  rowValue: { color: "#fff", fontSize: 17, fontWeight: "800", textAlign: "right" },
  rowValueStacked: { color: "#fff", fontSize: 18, fontWeight: "900", marginTop: 6 },
});
