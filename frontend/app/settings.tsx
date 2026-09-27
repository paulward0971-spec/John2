// Settings — editable demo profile + About-this-app info notice
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, Switch } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as LocalAuth from "expo-local-authentication";
import { colors } from "@/src/theme";
import { api } from "@/src/api";
import { storage } from "@/src/utils/storage";
import { isOwner as gateIsOwner } from "@/src/gate";

const BIO_KEY = "aib.biometric.enabled";
const BIO_LABEL_KEY = "aib.biometric.label";

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [profile, setProfile] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [bioHardware, setBioHardware] = useState<"face" | "finger" | null>(null);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [isOwnerDevice, setIsOwnerDevice] = useState(false);

  useEffect(() => {
    (async () => setProfile(await api.getProfile()))();
    (async () => setIsOwnerDevice(await gateIsOwner()))();
    (async () => {
      if (Platform.OS === "web") return;
      try {
        const has = await LocalAuth.hasHardwareAsync();
        const enrolled = await LocalAuth.isEnrolledAsync();
        if (!has || !enrolled) return;
        const types = await LocalAuth.supportedAuthenticationTypesAsync();
        const face = types.includes(LocalAuth.AuthenticationType.FACIAL_RECOGNITION);
        const label: "face" | "finger" = face ? "face" : "finger";
        setBioHardware(label);
        await storage.secureSet(BIO_LABEL_KEY, label);
        const on = await storage.secureGet<string>(BIO_KEY, "0");
        setBioEnabled(on === "1");
      } catch {}
    })();
  }, []);

  const toggleBio = async (next: boolean) => {
    if (!bioHardware) return;
    if (next) {
      try {
        const r = await LocalAuth.authenticateAsync({
          promptMessage: `Enable ${bioHardware === "face" ? "Face ID" : "Fingerprint"} for AIB`,
          cancelLabel: "Cancel",
          disableDeviceFallback: true,
        });
        if (!r.success) return;
      } catch {
        return;
      }
    }
    await storage.secureSet(BIO_KEY, next ? "1" : "0");
    setBioEnabled(next);
  };

  const set = (k: string, v: any) => setProfile((p: any) => ({ ...p, [k]: v }));

  const linkEmail = async () => {
    setLinkMsg(null); setErr(null);
    const email = (profile.email || "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr("Enter a valid email address first");
      return;
    }
    setLinking(true);
    try {
      const r = await api.verifyEmail(email);
      qc.invalidateQueries({ queryKey: ["profile"] });
      setLinkMsg(`Email linked. Confirmation sent (ref ${r.reference}).`);
    } catch (e: any) {
      setErr(e.message || "Could not link email");
    } finally { setLinking(false); }
  };

  const save = async () => {
    setErr(null);
    try {
      const patch: Record<string, any> = {
        display_name: profile.display_name,
        account_holder: profile.account_holder,
        account_label: profile.account_label,
        balance_cents: Math.round(Number(profile.balance_cents || 0)),
        available_cents: Math.round(Number(profile.available_cents || 0)),
        monthly_spent_cents: Math.round(Number(profile.monthly_spent_cents || 0)),
        card_last4: profile.card_last4,
        card_holder: profile.card_holder,
        card_expiry: profile.card_expiry,
        iban: profile.iban,
        bic: profile.bic,
        account_number: profile.account_number,
        sort_code: profile.sort_code,
        email: profile.email || null,
      };
      const updated = await api.updateProfile(patch);
      setProfile(updated);
      qc.invalidateQueries({ queryKey: ["profile"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch (e: any) { setErr(e.message || "Save failed"); }
  };

  if (!profile) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 8 }}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹  Back</Text></Pressable>
        <Text style={styles.h1}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={styles.info}>
          <Text style={styles.infoTitle}>About this app</Text>
          <Text style={styles.infoBody}>
            This app is a design demo built as an AIB competition entry — a working prototype, not a live banking service. All amounts, transactions and receipts are simulated.
          </Text>
        </View>

        <Section title="Security" />
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.toggleTitle}>
              {bioHardware === "face" ? "Face ID" : bioHardware === "finger" ? "Fingerprint" : "Biometric sign-in"}
            </Text>
            <Text style={styles.toggleBody}>
              {bioHardware
                ? `Unlock AIB with ${bioHardware === "face" ? "Face ID" : "your fingerprint"} instead of typing your PAC.`
                : "Not available on this device. Add a Face ID / fingerprint in your device settings to enable."}
            </Text>
          </View>
          <Switch
            value={bioEnabled}
            onValueChange={toggleBio}
            disabled={!bioHardware}
            trackColor={{ true: colors.brandPrimary, false: colors.border }}
            thumbColor="#fff"
            testID="bio-toggle"
          />
        </View>

        {isOwnerDevice ? (
          <Pressable
            style={styles.navRow}
            onPress={() => router.push("/admin/invites")}
            testID="manage-invites-btn"
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>Manage invite codes</Text>
              <Text style={styles.navBody}>
                Owner only. Generate one-time 4-digit codes to let people in.
              </Text>
            </View>
            <Text style={styles.navChev}>›</Text>
          </Pressable>
        ) : null}

        <Section title="Profile" />
        <Field label="Display name" value={profile.display_name} onChangeText={(v) => set("display_name", v)} testID="f-display" />
        <Field label="Account holder" value={profile.account_holder} onChangeText={(v) => set("account_holder", v)} testID="f-holder" />
        <Field label="Email (for receipts)" value={profile.email || ""} onChangeText={(v) => set("email", v)} keyboardType="email-address" autoCapitalize="none" testID="f-email" />

        <Pressable style={styles.linkBtn} disabled={linking} onPress={linkEmail} testID="link-email-btn">
          <Text style={styles.linkBtnText}>{linking ? "Sending confirmation…" : "Link email & send confirmation"}</Text>
        </Pressable>
        {linkMsg ? <Text style={styles.linkMsg}>{linkMsg}</Text> : null}

        <Section title="Account" />
        <Field label="Account label" value={profile.account_label} onChangeText={(v) => set("account_label", v)} testID="f-label" />
        <Field label="Balance (EUR)" value={String((profile.balance_cents ?? 0) / 100)} onChangeText={(v) => set("balance_cents", Number(v) * 100)} keyboardType="decimal-pad" testID="f-balance" />
        <Field label="Available (EUR)" value={String((profile.available_cents ?? 0) / 100)} onChangeText={(v) => set("available_cents", Number(v) * 100)} keyboardType="decimal-pad" testID="f-available" />
        <Field label="Monthly spent (EUR)" value={String((profile.monthly_spent_cents ?? 0) / 100)} onChangeText={(v) => set("monthly_spent_cents", Number(v) * 100)} keyboardType="decimal-pad" testID="f-monthly" />
        <Field label="IBAN" value={profile.iban} onChangeText={(v) => set("iban", v)} autoCapitalize="characters" testID="f-iban" />
        <Field label="BIC" value={profile.bic} onChangeText={(v) => set("bic", v)} autoCapitalize="characters" testID="f-bic" />
        <Field label="Account number" value={profile.account_number} onChangeText={(v) => set("account_number", v)} testID="f-accnum" />
        <Field label="Sort code" value={profile.sort_code} onChangeText={(v) => set("sort_code", v)} testID="f-sort" />

        <Section title="Card" />
        <Field label="Cardholder" value={profile.card_holder} onChangeText={(v) => set("card_holder", v)} testID="f-cardholder" />
        <Field label="Last 4" value={profile.card_last4} onChangeText={(v) => set("card_last4", v)} maxLength={4} keyboardType="number-pad" testID="f-last4" />
        <Field label="Expiry (MM/YY)" value={profile.card_expiry} onChangeText={(v) => set("card_expiry", v)} maxLength={5} testID="f-expiry" />

        {err ? <Text style={{ color: colors.error, marginTop: 12 }}>{err}</Text> : null}
        {saved ? <Text style={{ color: colors.success, marginTop: 12, fontWeight: "700" }}>Saved ✓</Text> : null}

        <Pressable style={styles.cta} onPress={save} testID="save-btn">
          <Text style={styles.ctaText}>Save changes</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title }: { title: string }) {
  return <Text style={styles.section}>{title}</Text>;
}

function Field({ label, testID, ...rest }: { label: string; testID: string; [k: string]: any }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.muted} testID={testID} {...rest} />
    </View>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.brandLight, fontSize: 15, fontWeight: "700" },
  h1: { color: "#fff", fontSize: 32, fontWeight: "900", marginTop: 8 },
  info: { backgroundColor: "rgba(100,181,246,0.10)", borderLeftWidth: 3, borderLeftColor: colors.info, borderRadius: 12, padding: 14, marginBottom: 18 },
  infoTitle: { color: colors.info, fontWeight: "800", fontSize: 14 },
  infoBody: { color: "#B5D6F5", fontSize: 13, marginTop: 6, lineHeight: 18 },
  section: { color: colors.brandLight, fontSize: 12, fontWeight: "800", letterSpacing: 1, marginTop: 14, marginBottom: 10, textTransform: "uppercase" },
  label: { color: colors.muted, fontSize: 12, marginBottom: 6, fontWeight: "700" },
  input: { backgroundColor: colors.surfaceSecondary, color: "#fff", padding: 14, borderRadius: 12, fontSize: 15, fontWeight: "600" },
  cta: { marginTop: 24, backgroundColor: colors.brandPrimary, padding: 16, borderRadius: 999, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  linkBtn: { marginTop: 4, marginBottom: 8, backgroundColor: colors.brandDeep, padding: 14, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: colors.brandPrimary },
  linkBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  linkMsg: { color: colors.success, fontSize: 13, marginTop: 4, marginBottom: 8, fontWeight: "700" },
  toggleRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14 },
  toggleTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  toggleBody: { color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 16 },
  navRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14, marginTop: 10 },
  navTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  navBody: { color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 16 },
  navChev: { color: colors.muted, fontSize: 22, fontWeight: "600", marginLeft: 12 },
});
