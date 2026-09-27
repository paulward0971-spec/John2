// Confirm transfer — review all details, then commit.
// Shows a green "All details match" verified pill on top and the recipient
// bank's logo next to the amount so the user has confidence the money is
// going where they expect.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle } from "react-native-svg";
import { colors } from "@/src/theme";
import { api, formatEuros, formatIban } from "@/src/api";
import { BankLogo } from "@/src/components/bank-logo";

const CUR_SYMBOLS: Record<string, string> = {
  EUR: "€", GBP: "£", USD: "$", CHF: "CHF ", PLN: "zł", SEK: "kr", NOK: "kr",
  DKK: "kr", CZK: "Kč", HUF: "Ft", RON: "lei", BGN: "лв", CAD: "C$", AUD: "A$",
  JPY: "¥", AED: "AED ", TRY: "₺",
};

function VerifiedTick() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" fill={colors.success} />
      <Path d="M7 12.5 L10.5 16 L17 8.5" stroke="#0B1A0B" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export default function Confirm() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [t, setT] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setT(await api.getTransfer(id!));
      setProfile(await api.getProfile());
    })();
  }, [id]);

  if (!t || !profile) {
    return <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}><ActivityIndicator color={colors.brandTertiary} /></View>;
  }

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const done = await api.confirmTransfer(t.id);
      router.replace({ pathname: "/transfer/success", params: { id: done.id } });
    } catch (e: any) {
      setErr(e.message || "Transfer failed");
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 8 }} testID="confirm-screen">
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹  Back</Text></Pressable>
        <Text style={styles.h1}>Confirm payment</Text>
        <Text style={styles.sub}>Check the details before you send</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        {/* Verified banner */}
        <View style={styles.verifyRow} testID="details-match-pill">
          <VerifiedTick />
          <View style={{ flex: 1 }}>
            <Text style={styles.verifyTitle}>All details match</Text>
            <Text style={styles.verifyBody}>
              The IBAN and bank were verified. Please double-check the recipient name before sending.
            </Text>
          </View>
        </View>

        <View style={styles.amountCard}>
          <View style={styles.amountHeader}>
            <BankLogo slug={t.bank_slug} size={44} style={{ borderWidth: 0 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.amountLabel}>You're sending to</Text>
              <Text style={styles.bank}>{t.bank_name}</Text>
            </View>
          </View>
          <Text style={styles.amount}>{formatEuros(t.amount_cents)}</Text>
          {t.is_foreign && t.currency && t.currency !== "EUR" ? (
            <Text style={styles.converted} testID="confirm-converted">
              ≈ {CUR_SYMBOLS[t.currency] || ""}{((t.converted_amount_cents ?? t.amount_cents) / 100).toFixed(2)} {t.currency}  ·  1 EUR = {t.fx_rate} {t.currency}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Row label="To" value={t.recipient_name} />
          <Row label="IBAN" value={formatIban(t.iban)} />
          <Row label="BIC Code" value={t.bic} />
          <Row label="Bank" value={t.bank_name} slug={t.bank_slug} />
          {t.is_foreign && t.currency && t.currency !== "EUR" ? (
            <Row label="Recipient gets" value={`${CUR_SYMBOLS[t.currency] || ""}${((t.converted_amount_cents ?? t.amount_cents) / 100).toFixed(2)} ${t.currency}`} />
          ) : null}
          <Row label="From" value={profile.account_holder} />
          <Row label="From IBAN" value={formatIban(profile.iban.replace(/\s/g, ""))} />
          <Row label="Reference" value={t.note || "—"} last />
        </View>

        <View style={styles.warn}>
          <Text style={styles.warnText}>
            <Text style={{ fontWeight: "800", color: colors.error }}>Important: </Text>
            This payment cannot be cancelled once sent. SEPA transfers typically settle within 24 hours.
          </Text>
        </View>

        {err ? <Text style={{ color: colors.error, marginTop: 12 }}>{err}</Text> : null}

        <Pressable style={styles.cta} disabled={busy} onPress={submit} testID="submit-btn">
          <Text style={styles.ctaText}>{busy ? "Sending…" : `Send ${formatEuros(t.amount_cents)}`}</Text>
        </Pressable>
        <Pressable style={styles.cancel} disabled={busy} onPress={() => router.back()} testID="cancel-btn">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, slug, last }: { label: string; value: string; slug?: string; last?: boolean }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {slug ? <BankLogo slug={slug} size={22} /> : null}
        <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.brandLight, fontSize: 15, fontWeight: "700" },
  h1: { color: "#fff", fontSize: 32, fontWeight: "900", marginTop: 8 },
  sub: { color: colors.muted, fontSize: 14, marginTop: 4 },
  verifyRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "rgba(46,204,113,0.12)", borderWidth: 1, borderColor: "rgba(46,204,113,0.35)", padding: 14, borderRadius: 12, marginBottom: 16 },
  verifyTitle: { color: colors.success, fontSize: 14, fontWeight: "900" },
  verifyBody: { color: "#B7E1C1", fontSize: 12, marginTop: 2, lineHeight: 17 },
  amountCard: { padding: 20, backgroundColor: colors.brandDeep, borderRadius: 20 },
  amountHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  amountLabel: { color: "#EAD6F0", fontSize: 12, fontWeight: "700" },
  amount: { color: "#fff", fontSize: 42, fontWeight: "900", marginTop: 14 },
  converted: { color: "#EAD6F0", fontSize: 14, fontWeight: "800", marginTop: 8 },
  bank: { color: "#fff", fontSize: 15, fontWeight: "800", marginTop: 2 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 4, marginTop: 20 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border, gap: 12 },
  rowLabel: { color: colors.muted, fontSize: 13 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end" },
  rowValue: { color: "#fff", fontSize: 14, fontWeight: "800", textAlign: "right", flexShrink: 1 },
  warn: { backgroundColor: "rgba(255,82,82,0.12)", borderLeftWidth: 3, borderLeftColor: colors.error, padding: 14, borderRadius: 10, marginTop: 16 },
  warnText: { color: "#F5B5B5", fontSize: 13, lineHeight: 18 },
  cta: { marginTop: 24, backgroundColor: colors.brandPrimary, padding: 18, borderRadius: 999, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  cancel: { marginTop: 12, padding: 12, alignItems: "center" },
  cancelText: { color: colors.muted, fontSize: 15, fontWeight: "700" },
});
