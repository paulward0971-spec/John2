import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors } from "@/src/theme";
import { api } from "@/src/api";

export default function SetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("Personal Account");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onCompleteSetup = async () => {
    if (!name.trim()) {
      setErr("Please enter your name");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.setupProfile({
        display_name: name.trim(),
        account_label: `AIB ${accountType.toUpperCase()}-001`,
        initial_balance_cents: 350000,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e.message || "Could not complete setup");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: insets.top + 30, paddingBottom: insets.bottom + 20, justifyContent: "space-between" }}>
        <View>
          <LinearGradient colors={["#8E24AA", "#5F1478"]} style={styles.badge}>
            <Text style={styles.badgeText}>⚡</Text>
          </LinearGradient>
          <Text style={styles.title}>Personalize Your Account</Text>
          <Text style={styles.subtitle}>Welcome! Please configure your private demo workspace.</Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Alex Morgan"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={(t) => { setErr(null); setName(t); }}
            autoFocus
          />

          <Text style={styles.label}>Account Purpose / Label</Text>
          <View style={styles.chipRow}>
            {["Personal Account", "Everyday Current", "Savings Vault"].map((t) => (
              <Pressable
                key={t}
                style={[styles.chip, accountType === t && styles.chipActive]}
                onPress={() => setAccountType(t)}
              >
                <Text style={[styles.chipText, accountType === t && styles.chipTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>Isolated Instance</Text>
            <Text style={styles.noticeBody}>All balances, SEPA transfers, and conversations with Abby are dedicated solely to this phone.</Text>
          </View>

          {err && <Text style={styles.err}>{err}</Text>}
        </View>

        <Pressable
          style={[styles.submitBtn, (!name.trim() || busy) && { opacity: 0.5 }]}
          disabled={!name.trim() || busy}
          onPress={onCompleteSetup}
        >
          <Text style={styles.submitBtnText}>{busy ? "Configuring..." : "Launch My Banking App"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  badge: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  badgeText: { fontSize: 30 },
  title: { color: "#fff", fontSize: 28, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 8, lineHeight: 20 },
  label: { color: colors.brandLight, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 24, marginBottom: 8 },
  input: { backgroundColor: colors.surfaceSecondary, color: "#fff", padding: 16, borderRadius: 14, fontSize: 16, fontWeight: "600", borderWidth: 1, borderColor: colors.border },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandLight },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  noticeBox: { backgroundColor: "rgba(142,36,170,0.12)", borderWidth: 1, borderColor: "rgba(142,36,170,0.3)", borderRadius: 14, padding: 16, marginTop: 24 },
  noticeTitle: { color: colors.brandLight, fontSize: 13, fontWeight: "800" },
  noticeBody: { color: "#EED4F5", fontSize: 12, marginTop: 4, lineHeight: 17 },
  err: { color: colors.error, fontSize: 13, marginTop: 12, fontWeight: "700" },
  submitBtn: { backgroundColor: colors.brandPrimary, padding: 16, borderRadius: 999, alignItems: "center" },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },
});
