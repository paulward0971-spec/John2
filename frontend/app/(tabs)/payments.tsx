// Payments tab — every action is clickable now.
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, TextInput, Share, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/src/theme";
import { api, formatIban } from "@/src/api";

function ArrowIcon({ dir, color = "#fff" }: { dir: "up" | "down"; color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      {dir === "up" ? (
        <Path d="M12 20 V4 M6 10 L12 4 L18 10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ) : (
        <Path d="M12 4 V20 M6 14 L12 20 L18 14" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      )}
    </Svg>
  );
}

export default function Payments() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useQuery({ queryKey: ["profile"], queryFn: api.getProfile });
  const payees = useQuery({ queryKey: ["payees"], queryFn: api.listPayees });

  const [showExisting, setShowExisting] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [showStanding, setShowStanding] = useState(false);
  const [soName, setSoName] = useState("");
  const [soIban, setSoIban] = useState("");
  const [soAmount, setSoAmount] = useState("");
  const [soFreq, setSoFreq] = useState<"weekly" | "monthly">("monthly");

  const shareIban = async () => {
    const iban = profile.data?.iban || "";
    const bic = profile.data?.bic || "";
    const name = profile.data?.account_holder || "";
    const msg = `Please send money to my AIB account:\n\nName: ${name}\nIBAN: ${iban}\nBIC: ${bic}`;
    try {
      if (Platform.OS === "web") {
        if ((navigator as any).share) await (navigator as any).share({ text: msg });
        else await (navigator as any).clipboard.writeText(msg);
      } else {
        await Share.share({ message: msg });
      }
    } catch {}
    setShowRequest(false);
  };

  const submitStanding = () => {
    setShowStanding(false);
    setSoName(""); setSoIban(""); setSoAmount("");
    router.push("/transfer/new");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top + 12 }} testID="payments-screen">
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Text style={styles.title}>Payments</Text>
        <Text style={styles.sub}>Send and receive money</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <Pressable style={styles.row} onPress={() => router.push("/transfer/new")} testID="payment-action-iban">
          <View style={styles.iconWrap}><ArrowIcon dir="up" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Pay someone new</Text>
            <Text style={styles.rowSub}>Send a SEPA transfer with IBAN</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>

        <Pressable style={styles.row} onPress={() => setShowExisting(true)} testID="payment-action-existing">
          <View style={styles.iconWrap}><ArrowIcon dir="up" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Pay an existing payee</Text>
            <Text style={styles.rowSub}>Choose from your saved payees</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>

        <Pressable style={styles.row} onPress={() => setShowRequest(true)} testID="payment-action-receive">
          <View style={styles.iconWrap}><ArrowIcon dir="down" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Request money</Text>
            <Text style={styles.rowSub}>Send someone your IBAN</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>

        <Pressable style={styles.row} onPress={() => setShowStanding(true)} testID="payment-action-standing">
          <View style={styles.iconWrap}><ArrowIcon dir="up" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Standing orders</Text>
            <Text style={styles.rowSub}>Set up recurring payments</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      </ScrollView>

      {/* Existing payee sheet */}
      <Modal visible={showExisting} transparent animationType="slide" onRequestClose={() => setShowExisting(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowExisting(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Choose a payee</Text>
            {(payees.data || []).length === 0 ? (
              <Text style={styles.empty}>You have no saved payees yet. Send a payment once and they'll show up here.</Text>
            ) : (
              (payees.data || []).map((p: any) => (
                <Pressable
                  key={p.id}
                  style={styles.payeeRow}
                  onPress={() => { setShowExisting(false); router.push("/transfer/new"); }}
                  testID={`existing-${p.id}`}
                >
                  <View style={styles.payeeAvatar}>
                    <Text style={styles.payeeAvatarText}>
                      {p.name.split(" ").map((s: string) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payeeName}>{p.name}</Text>
                    <Text style={styles.payeeSub}>{p.bank_name} • {formatIban(p.iban).slice(0, 19)}…</Text>
                  </View>
                  <Text style={styles.chev}>›</Text>
                </Pressable>
              ))
            )}
            <Pressable style={styles.sheetBtn} onPress={() => { setShowExisting(false); router.push("/transfer/new"); }}>
              <Text style={styles.sheetBtnText}>New payee</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Request money sheet */}
      <Modal visible={showRequest} transparent animationType="slide" onRequestClose={() => setShowRequest(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowRequest(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Request money</Text>
            <Text style={styles.empty}>Share your IBAN so someone can pay you.</Text>
            <View style={styles.detailBox}>
              <Text style={styles.detailLabel}>Name</Text>
              <Text style={styles.detailValue}>{profile.data?.account_holder}</Text>
              <Text style={[styles.detailLabel, { marginTop: 12 }]}>IBAN</Text>
              <Text style={styles.detailValue}>{formatIban(profile.data?.iban || "")}</Text>
              <Text style={[styles.detailLabel, { marginTop: 12 }]}>BIC</Text>
              <Text style={styles.detailValue}>{profile.data?.bic}</Text>
            </View>
            <Pressable style={styles.sheetBtn} onPress={shareIban} testID="request-share">
              <Text style={styles.sheetBtnText}>Share IBAN</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Standing order sheet */}
      <Modal visible={showStanding} transparent animationType="slide" onRequestClose={() => setShowStanding(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowStanding(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>New standing order</Text>
            <TextInput style={styles.input} placeholder="Payee name" placeholderTextColor={colors.muted} value={soName} onChangeText={setSoName} />
            <TextInput style={styles.input} placeholder="IBAN" placeholderTextColor={colors.muted} value={soIban} onChangeText={setSoIban} autoCapitalize="characters" />
            <TextInput style={styles.input} placeholder="Amount (EUR)" placeholderTextColor={colors.muted} value={soAmount} onChangeText={setSoAmount} keyboardType="decimal-pad" />
            <View style={styles.freqRow}>
              {(["weekly", "monthly"] as const).map((f) => (
                <Pressable key={f} onPress={() => setSoFreq(f)} style={[styles.freqPill, soFreq === f && styles.freqPillActive]}>
                  <Text style={[styles.freqText, soFreq === f && { color: "#fff" }]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.sheetBtn} onPress={submitStanding}>
              <Text style={styles.sheetBtnText}>Continue</Text>
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
  row: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surfaceSecondary, padding: 16, borderRadius: 16, marginTop: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  rowSub: { color: colors.muted, marginTop: 4, fontSize: 13 },
  chev: { color: colors.muted, fontSize: 24 },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F0F0F", padding: 20, paddingBottom: 32, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#3D3D3D", alignSelf: "center", marginBottom: 16 },
  sheetTitle: { color: "#fff", fontSize: 20, fontWeight: "900", marginBottom: 12 },
  empty: { color: colors.muted, fontSize: 14, marginBottom: 12 },
  payeeRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: "#1F1F1F" },
  payeeAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  payeeAvatarText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  payeeName: { color: "#fff", fontSize: 15, fontWeight: "800" },
  payeeSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  detailBox: { backgroundColor: "#161616", padding: 14, borderRadius: 12, marginBottom: 16 },
  detailLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  detailValue: { color: "#fff", fontSize: 15, fontWeight: "800", marginTop: 4 },
  input: { backgroundColor: "#161616", color: "#fff", padding: 14, borderRadius: 12, fontSize: 15, fontWeight: "600", marginBottom: 10 },
  freqRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  freqPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: "#161616" },
  freqPillActive: { backgroundColor: colors.brandPrimary },
  freqText: { color: colors.muted, fontWeight: "700" },
  sheetBtn: { backgroundColor: colors.brandPrimary, padding: 14, borderRadius: 999, alignItems: "center", marginTop: 8 },
  sheetBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
