// New IBAN transfer entry — recent payees, live bank detection, amount, ref
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing } from "@/src/theme";
import { api, formatIban } from "@/src/api";
import { BankLogo } from "@/src/components/bank-logo";

const CUR_SYMBOLS: Record<string, string> = {
  EUR: "€", GBP: "£", USD: "$", CHF: "CHF ", PLN: "zł", SEK: "kr", NOK: "kr",
  DKK: "kr", CZK: "Kč", HUF: "Ft", RON: "lei", BGN: "лв", CAD: "C$", AUD: "A$",
  JPY: "¥", AED: "AED ", TRY: "₺",
};

export default function NewTransfer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ iban?: string; amount?: string; name?: string }>();
  const [name, setName] = useState(params.name ? String(params.name) : "");
  const [iban, setIban] = useState(params.iban ? String(params.iban) : "");
  const [amount, setAmount] = useState(params.amount ? String(params.amount) : "");
  const [ref, setRef] = useState("");
  const [bic, setBic] = useState("");
  const [bicTouched, setBicTouched] = useState(false);
  const [receiptEmail, setReceiptEmail] = useState("");
  const [bank, setBank] = useState<{ bank_name: string; bic: string; slug?: string; is_valid: boolean; currency?: string; fx_rate?: number; is_foreign?: boolean; country_name?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const payees = useQuery({ queryKey: ["payees"], queryFn: api.listPayees });
  const cleanedIban = useMemo(() => iban.replace(/\s+/g, "").toUpperCase(), [iban]);

  useEffect(() => {
    if (cleanedIban.length < 6) { setBank(null); return; }
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const b = await api.ibanLookup(cleanedIban);
        setBank(b);
      } catch { setBank(null); }
      finally { setChecking(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [cleanedIban]);

  const canContinue = name.trim().length > 1 && cleanedIban.length >= 15 && Number(amount) > 0;

  // Prefill BIC from the detected bank until the user edits it manually.
  useEffect(() => {
    if (bank?.bic && !bicTouched) setBic(bank.bic);
  }, [bank, bicTouched]);

  const usePayee = (p: any) => {
    setName(p.name);
    setIban(p.iban);
  };

  const onContinue = async () => {
    setErr(null); setBusy(true);
    try {
      const cents = Math.round(Number(amount) * 100);
      const t = await api.prepareTransfer({
        recipient_name: name.trim(),
        iban: cleanedIban,
        amount_cents: cents,
        reference: ref || undefined,
        bic: bic.trim() ? bic.trim().toUpperCase() : undefined,
        receipt_email: receiptEmail.includes("@") ? receiptEmail.trim() : undefined,
      });
      router.push({ pathname: "/transfer/confirm", params: { id: t.id } });
    } catch (e: any) {
      setErr(e.message || "Could not prepare transfer");
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 8 }}>
        <Pressable onPress={() => router.back()} testID="back-btn"><Text style={styles.back}>‹  Back</Text></Pressable>
        <Text style={styles.h1}>Send money</Text>
        <Text style={styles.sub}>SEPA transfer to any Irish or EU account</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

        {(payees.data || []).length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <Text style={styles.recentLabel}>Recent payees</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.payeeRow}>
              {(payees.data || []).map((p: any) => (
                <Pressable
                  key={p.id}
                  style={styles.payeeCard}
                  onPress={() => usePayee(p)}
                  testID={`payee-${p.id}`}
                >
                  <View style={styles.payeeAvatarWrap}>
                    <View style={styles.payeeAvatar}>
                      <Text style={styles.payeeAvatarText}>
                        {p.name.split(" ").map((s: string) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                      </Text>
                    </View>
                    {p.bank_slug ? (
                      <View style={styles.payeeBankBadge}>
                        <BankLogo slug={p.bank_slug} size={22} />
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.payeeName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.payeeBank} numberOfLines={1}>{p.bank_name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <Text style={styles.label}>Recipient name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. John Carthy"
          placeholderTextColor={colors.muted}
          testID="input-name"
        />

        <Text style={styles.label}>IBAN</Text>
        <TextInput
          style={styles.input}
          value={formatIban(iban)}
          onChangeText={(v) => setIban(v.replace(/\s+/g, ""))}
          placeholder="IE29 AIBK 8492 8392 8282 09"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          testID="input-iban"
        />
        {cleanedIban.length >= 6 && (
          <View style={styles.bankRow} testID="bank-detect">
            {checking ? (
              <ActivityIndicator color={colors.brandTertiary} />
            ) : (
              <>
                <BankLogo slug={bank?.slug} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bankName} numberOfLines={1}>
                    {bank?.bank_name || "Detecting bank…"}
                  </Text>
                  {bank?.bic ? <Text style={styles.bankBic}>{bank.bic}</Text> : null}
                  {bank?.is_foreign ? (
                    <Text style={styles.bankForeign} testID="foreign-badge">🌍 Foreign bank · sends in {bank?.currency}</Text>
                  ) : null}
                </View>
              </>
            )}
          </View>
        )}

        <Text style={styles.label}>BIC / SWIFT</Text>
        <TextInput
          style={styles.input}
          value={bic}
          onChangeText={(v) => { setBicTouched(true); setBic(v.toUpperCase()); }}
          placeholder="BIC / SWIFT"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={11}
          testID="input-bic"
        />

        <Text style={styles.label}>Amount (EUR)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          testID="input-amount"
        />

        {bank?.is_foreign && bank?.currency && bank.currency !== "EUR" && Number(amount) > 0 ? (
          <View style={styles.fxBox} testID="fx-preview">
            <Text style={styles.fxTitle}>Currency conversion</Text>
            <Text style={styles.fxAmount}>
              Recipient gets ≈ {CUR_SYMBOLS[bank.currency] || ""}{(Number(amount) * (bank?.fx_rate || 1)).toFixed(2)} {bank.currency}
            </Text>
            <Text style={styles.fxSub}>
              You send €{Number(amount).toFixed(2)}  ·  1 EUR = {bank?.fx_rate} {bank.currency}
            </Text>
          </View>
        ) : null}


        <Text style={styles.label}>Reference (optional)</Text>
        <TextInput
          style={styles.input}
          value={ref}
          onChangeText={setRef}
          placeholder="e.g. Rent September"
          placeholderTextColor={colors.muted}
          maxLength={35}
          testID="input-ref"
        />

        <Text style={styles.label}>Email receipt to (optional)</Text>
        <TextInput
          style={styles.input}
          value={receiptEmail}
          onChangeText={setReceiptEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          testID="input-receipt-email"
        />
        <Text style={styles.emailHint}>We'll email a clearly-labelled MOCK demo receipt (not a real payment).</Text>

        {err ? <Text style={styles.err}>{err}</Text> : null}

        <Pressable
          style={[styles.cta, !canContinue && { opacity: 0.4 }]}
          disabled={!canContinue || busy}
          onPress={onContinue}
          testID="continue-btn"
        >
          <Text style={styles.ctaText}>{busy ? "Preparing…" : "Continue"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.brandLight, fontSize: 15, fontWeight: "700" },
  h1: { color: "#fff", fontSize: 32, fontWeight: "900", marginTop: 8 },
  sub: { color: colors.muted, fontSize: 14, marginTop: 4 },
  recentLabel: { color: colors.muted, fontSize: 13, fontWeight: "700", marginBottom: 10 },
  payeeRow: { gap: 10, paddingRight: 8 },
  payeeCard: { width: 110, backgroundColor: colors.surfaceSecondary, borderRadius: 14, padding: 12, alignItems: "center" },
  payeeAvatarWrap: { width: 44, height: 44, marginBottom: 8 },
  payeeAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  payeeAvatarText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  payeeBankBadge: { position: "absolute", right: -6, bottom: -4, backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 1 },
  payeeName: { color: "#fff", fontSize: 13, fontWeight: "800" },
  payeeBank: { color: colors.muted, fontSize: 11, marginTop: 2 },
  label: { color: colors.muted, fontSize: 13, marginTop: 20, marginBottom: 8, fontWeight: "700" },
  input: { backgroundColor: colors.surfaceSecondary, color: "#fff", fontSize: 16, padding: 14, borderRadius: 12, fontWeight: "600" },
  bankRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8, backgroundColor: colors.surfaceSecondary, padding: 12, borderRadius: 10 },
  bankDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandTertiary },
  bankName: { color: "#fff", fontSize: 14, fontWeight: "800" },
  bankBic: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  bankForeign: { color: colors.brandTertiary, fontSize: 12, fontWeight: "800", marginTop: 3 },
  fxBox: { marginTop: 14, backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: colors.brandTertiary },
  fxTitle: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  fxAmount: { color: "#fff", fontSize: 18, fontWeight: "900", marginTop: 6 },
  fxSub: { color: colors.muted, fontSize: 12, marginTop: 4 },
  emailHint: { color: colors.muted, fontSize: 11, marginTop: 8, lineHeight: 16 },
  cta: { marginTop: 30, backgroundColor: colors.brandPrimary, padding: 16, borderRadius: 999, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  err: { color: colors.error, marginTop: 12 },
});
