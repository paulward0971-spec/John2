// Owner-only invite code admin. Reached from Settings → "Manage invite codes".
// Flow:
//   1. Owner enters the 4-digit admin PIN (default 9876, changeable here)
//   2. Toggle the invite gate on/off
//   3. Generate a new 4-digit PIN to hand to a friend
//   4. See used/unused/revoked status; revoke unused pins
//   5. Change the admin PIN
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Switch, Platform, Share } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { colors } from "@/src/theme";
import { admin } from "@/src/gate";

type PinRow = {
  pin: string;
  label?: string;
  used: boolean;
  used_by_device?: string | null;
  used_at?: string | null;
  revoked?: boolean;
  created_at: string;
};

export default function InviteAdmin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [unlocked, setUnlocked] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [gateOn, setGateOn] = useState(false);
  const [pins, setPins] = useState<PinRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [showChangePin, setShowChangePin] = useState(false);
  const [newAdminPin, setNewAdminPin] = useState("");

  const unlock = async () => {
    setPinErr(null);
    try {
      await admin.login(adminPin);
      setUnlocked(true);
      await refresh();
    } catch (e: any) {
      setPinErr(e?.message || "Wrong PIN");
      setAdminPin("");
    }
  };

  const refresh = async () => {
    try {
      const [cfg, rows] = await Promise.all([admin.config(), admin.listPins()]);
      setGateOn(!!cfg?.enabled);
      setPins(rows as PinRow[]);
    } catch {}
  };

  const flashMsg = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2200);
  };

  const toggle = async (v: boolean) => {
    setBusy(true);
    try {
      const r = await admin.toggleGate(v);
      setGateOn(!!r.enabled);
      flashMsg(v ? "Invite gate ON — new visitors need a code" : "Invite gate OFF");
    } catch (e: any) {
      flashMsg(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setBusy(true);
    try {
      const p = await admin.generate(label.trim() || undefined);
      setLabel("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      flashMsg(`New code: ${p.pin}${p.label ? ` (${p.label})` : ""}`);
      await refresh();
    } catch (e: any) {
      flashMsg(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (pin: string) => {
    setBusy(true);
    try {
      await admin.revokePin(pin);
      flashMsg("Revoked");
      await refresh();
    } catch (e: any) {
      flashMsg(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (pin: string) => {
    try {
      await Clipboard.setStringAsync(pin);
      flashMsg(`Copied ${pin}`);
    } catch {}
  };

  const share = async (pin: string) => {
    try {
      if (Platform.OS === "web") {
        await copy(pin);
        return;
      }
      await Share.share({
        message: `Your AIB invite code: ${pin}\n\nOpen the app and enter this 4-digit code.`,
      });
    } catch {}
  };

  const changeAdminPin = async () => {
    if (!/^\d{4}$/.test(newAdminPin)) {
      flashMsg("Admin PIN must be 4 digits");
      return;
    }
    setBusy(true);
    try {
      await admin.setAdminPin(newAdminPin);
      setNewAdminPin("");
      setShowChangePin(false);
      flashMsg("Admin PIN updated");
    } catch (e: any) {
      flashMsg(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  // LOCK SCREEN
  if (!unlocked) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>‹  Back</Text>
          </Pressable>
          <Text style={styles.h1}>Manage invite codes</Text>
          <Text style={styles.sub}>Enter your admin PIN to continue</Text>
        </View>
        <View style={styles.lockCenter}>
          <TextInput
            value={adminPin}
            onChangeText={(t) => {
              setPinErr(null);
              setAdminPin(t.replace(/\D/g, "").slice(0, 4));
            }}
            style={styles.pinInput}
            placeholder="0000"
            placeholderTextColor="#555"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            autoFocus
            testID="admin-pin-input"
          />
          {pinErr ? <Text style={styles.err}>{pinErr}</Text> : null}
          <Pressable
            style={[styles.primary, adminPin.length !== 4 && { opacity: 0.4 }]}
            disabled={adminPin.length !== 4}
            onPress={unlock}
            testID="admin-unlock"
          >
            <Text style={styles.primaryText}>Unlock</Text>
          </Pressable>
          <Text style={styles.hint}>Default is 9876. You can change it after unlocking.</Text>
        </View>
      </View>
    );
  }

  const active = pins.filter((p) => !p.used && !p.revoked);
  const used = pins.filter((p) => p.used);
  const revoked = pins.filter((p) => p.revoked && !p.used);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹  Back</Text>
        </Pressable>
        <Text style={styles.h1}>Invite codes</Text>
        <Text style={styles.sub}>Only people with a code you give them can enter</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.rowTitle}>Invite gate</Text>
              <Text style={styles.rowBody}>
                {gateOn
                  ? "ON — visitors need a valid 4-digit code."
                  : "OFF — anyone with the link can open the app."}
              </Text>
            </View>
            <Switch
              value={gateOn}
              onValueChange={toggle}
              disabled={busy}
              trackColor={{ true: colors.brandPrimary, false: colors.border }}
              thumbColor="#fff"
              testID="gate-toggle"
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.rowTitle}>Generate a new code</Text>
          <Text style={styles.rowBody}>
            Each code is a random 4-digit PIN that dies the moment someone uses it.
          </Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            style={styles.labelInput}
            placeholder="Label (optional, e.g. 'For Michael')"
            placeholderTextColor="#555"
            maxLength={40}
            testID="label-input"
          />
          <Pressable
            style={[styles.primary, busy && { opacity: 0.6 }]}
            onPress={generate}
            disabled={busy}
            testID="generate-btn"
          >
            <Text style={styles.primaryText}>Generate PIN</Text>
          </Pressable>
        </View>

        <SectionHeader label={`Active (${active.length})`} help="These codes are unused and still valid" />
        {active.length === 0 ? (
          <Text style={styles.empty}>No active codes. Generate one above.</Text>
        ) : (
          active.map((p) => (
            <View key={p.pin} style={styles.pinRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pinBig}>{p.pin}</Text>
                {p.label ? <Text style={styles.pinLabel}>{p.label}</Text> : null}
                <Text style={styles.pinTs}>Created {relTime(p.created_at)}</Text>
              </View>
              <View style={styles.pinActions}>
                <Pressable style={styles.mini} onPress={() => copy(p.pin)}>
                  <Text style={styles.miniText}>Copy</Text>
                </Pressable>
                <Pressable style={styles.mini} onPress={() => share(p.pin)}>
                  <Text style={styles.miniText}>Share</Text>
                </Pressable>
                <Pressable style={[styles.mini, styles.miniDanger]} onPress={() => revoke(p.pin)}>
                  <Text style={[styles.miniText, styles.miniDangerText]}>Revoke</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <SectionHeader label={`Used (${used.length})`} help="Already redeemed. The device on the other side is inside." />
        {used.map((p) => (
          <View key={p.pin} style={[styles.pinRow, { opacity: 0.65 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pinBig, { textDecorationLine: "line-through" }]}>{p.pin}</Text>
              {p.label ? <Text style={styles.pinLabel}>{p.label}</Text> : null}
              <Text style={styles.pinTs}>Redeemed {p.used_at ? relTime(p.used_at) : ""}</Text>
            </View>
            <Pressable style={[styles.mini, styles.miniDanger]} onPress={() => revoke(p.pin)}>
              <Text style={[styles.miniText, styles.miniDangerText]}>Kick out</Text>
            </Pressable>
          </View>
        ))}

        {revoked.length > 0 ? (
          <>
            <SectionHeader label={`Revoked (${revoked.length})`} help="These codes are dead" />
            {revoked.map((p) => (
              <View key={p.pin} style={[styles.pinRow, { opacity: 0.4 }]}>
                <Text style={[styles.pinBig, { textDecorationLine: "line-through" }]}>{p.pin}</Text>
                {p.label ? <Text style={styles.pinLabel}>{p.label}</Text> : null}
              </View>
            ))}
          </>
        ) : null}

        <View style={{ height: 24 }} />

        <View style={styles.card}>
          <Text style={styles.rowTitle}>Change admin PIN</Text>
          {!showChangePin ? (
            <Pressable style={styles.secondary} onPress={() => setShowChangePin(true)}>
              <Text style={styles.secondaryText}>Change PIN</Text>
            </Pressable>
          ) : (
            <>
              <TextInput
                value={newAdminPin}
                onChangeText={(t) => setNewAdminPin(t.replace(/\D/g, "").slice(0, 4))}
                style={styles.labelInput}
                placeholder="New 4-digit PIN"
                placeholderTextColor="#555"
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
              />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  style={[styles.primary, { flex: 1 }, newAdminPin.length !== 4 && { opacity: 0.4 }]}
                  disabled={newAdminPin.length !== 4}
                  onPress={changeAdminPin}
                >
                  <Text style={styles.primaryText}>Save</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondary, { flex: 1 }]}
                  onPress={() => {
                    setShowChangePin(false);
                    setNewAdminPin("");
                  }}
                >
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ label, help }: { label: string; help: string }) {
  return (
    <View style={{ marginTop: 22, marginBottom: 8 }}>
      <Text style={styles.section}>{label}</Text>
      <Text style={styles.sectionHelp}>{help}</Text>
    </View>
  );
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!t) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} d ago`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  back: { color: colors.brandLight, fontSize: 15, fontWeight: "700" },
  h1: { color: "#fff", fontSize: 32, fontWeight: "900", marginTop: 8 },
  sub: { color: colors.muted, fontSize: 13, marginTop: 4 },
  msg: { color: colors.success, textAlign: "center", fontWeight: "800", fontSize: 13, marginBottom: 10 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 14, padding: 16, marginBottom: 14 },
  rowBetween: { flexDirection: "row", alignItems: "center" },
  rowTitle: { color: "#fff", fontSize: 15, fontWeight: "900" },
  rowBody: { color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  labelInput: { backgroundColor: "#0F0F0F", color: "#fff", fontSize: 15, padding: 12, borderRadius: 10, marginTop: 12, borderWidth: 1, borderColor: colors.border },
  primary: { backgroundColor: colors.brandPrimary, padding: 14, borderRadius: 999, alignItems: "center", marginTop: 12 },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  secondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 999, alignItems: "center", marginTop: 12 },
  secondaryText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  section: { color: "#fff", fontSize: 15, fontWeight: "900" },
  sectionHelp: { color: colors.muted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.muted, fontSize: 13, fontStyle: "italic", padding: 12 },
  pinRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 14, marginBottom: 10, gap: 12 },
  pinBig: { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: 4 },
  pinLabel: { color: colors.brandLight, fontSize: 12, fontWeight: "700", marginTop: 2 },
  pinTs: { color: colors.muted, fontSize: 11, marginTop: 4 },
  pinActions: { flexDirection: "column", gap: 6 },
  mini: { backgroundColor: colors.brandDeep, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  miniText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  miniDanger: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.error },
  miniDangerText: { color: colors.error },
  lockCenter: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  pinInput: { backgroundColor: colors.surfaceSecondary, color: "#fff", fontSize: 32, letterSpacing: 20, textAlign: "center", padding: 16, borderRadius: 12, width: 220, fontWeight: "900" },
  err: { color: colors.error, marginTop: 10, fontWeight: "700" },
  hint: { color: colors.muted, fontSize: 12, marginTop: 20, textAlign: "center" },
});
