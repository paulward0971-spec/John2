// Invite gate screen — shown when the invite gate is on and this device
// has no valid token. User enters a 4-digit PIN issued by the owner. On
// success the PIN is burnt server-side and a device token is stored, so
// they never see this screen again on this phone.
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions, Platform, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { redeemPin, recoverOwner } from "@/src/gate";

const PIN_LEN = 4;
const { width, height } = Dimensions.get("window");
const KEY_W = (width - 32) / 3;
const KEY_H = Math.min(90, (height * 0.45) / 4);
const KEYS: (string | null)[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", null, "0", "del"];

export default function Invite() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRecover, setShowRecover] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoverErr, setRecoverErr] = useState<string | null>(null);
  const [recoverBusy, setRecoverBusy] = useState(false);
  const shake = useSharedValue(0);

  const doRecover = async () => {
    setRecoverErr(null);
    if ((recoveryCode || "").trim().length < 6) {
      setRecoverErr("Enter your recovery code");
      return;
    }
    setRecoverBusy(true);
    try {
      await recoverOwner(recoveryCode.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace("/passcode");
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setRecoverErr(e?.message || "Invalid recovery code");
    } finally {
      setRecoverBusy(false);
    }
  };

  const doShake = () => {
    shake.value = withSequence(
      withTiming(-12, { duration: 60 }),
      withTiming(12, { duration: 60 }),
      withTiming(-8, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );
  };

  const submit = async (code: string) => {
    setBusy(true);
    try {
      await redeemPin(code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace("/passcode");
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setErr(e?.message || "Invalid or already-used code");
      doShake();
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const press = (v: string) => {
    setErr(null);
    Haptics.selectionAsync().catch(() => {});
    if (v === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= PIN_LEN || busy) return;
    const next = pin + v;
    setPin(next);
    if (next.length === PIN_LEN) submit(next);
  };

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]} testID="invite-screen">
      <View style={styles.top}>
        <View style={styles.lockCircle}>
          <Text style={styles.lockText}>🔒</Text>
        </View>
        <Text style={styles.title}>Enter invite code</Text>
        <Text style={styles.body}>
          This app is private. Enter the 4-digit invite code you were given to continue.
        </Text>
      </View>

      <Animated.View style={[styles.dots, shakeStyle]}>
        {Array.from({ length: PIN_LEN }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i < pin.length && styles.dotFilled, err ? styles.dotErr : null]}
            testID={`invite-dot-${i}`}
          />
        ))}
      </Animated.View>
      {err ? <Text style={styles.err}>{err}</Text> : <View style={{ height: 20 }} />}

      <View style={styles.pad}>
        {KEYS.map((k, i) => (
          <View key={i} style={{ width: KEY_W, height: KEY_H, alignItems: "center", justifyContent: "center" }}>
            {k === null ? (
              <View />
            ) : k === "del" ? (
              <Pressable onPress={() => press("del")} style={styles.plainKey} testID="invite-key-del">
                <Text style={styles.delText}>⌫</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => press(k)} style={styles.plainKey} testID={`invite-key-${k}`}>
                <Text style={styles.numText}>{k}</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        {!showRecover ? (
          <>
            <Text style={styles.footerText}>
              Don't have a code? Ask the person who shared this app with you for a new invite code.
            </Text>
            <Pressable onPress={() => setShowRecover(true)} testID="show-recover-btn" hitSlop={10}>
              <Text style={styles.recoverLink}>I'm the owner — recover access</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.recoverBox}>
            <Text style={styles.recoverTitle}>Owner recovery</Text>
            <TextInput
              value={recoveryCode}
              onChangeText={(t) => {
                setRecoverErr(null);
                setRecoveryCode(t);
              }}
              style={styles.recoverInput}
              placeholder="Recovery code"
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              testID="invite-recovery-input"
            />
            {recoverErr ? <Text style={styles.err}>{recoverErr}</Text> : null}
            <Pressable
              style={[styles.recoverBtn, recoverBusy && { opacity: 0.5 }]}
              disabled={recoverBusy}
              onPress={doRecover}
              testID="invite-recover-btn"
            >
              <Text style={styles.recoverBtnText}>{recoverBusy ? "Checking…" : "Restore owner access"}</Text>
            </Pressable>
            <Pressable onPress={() => setShowRecover(false)} hitSlop={10}>
              <Text style={styles.recoverCancel}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingHorizontal: 16, justifyContent: "space-between" },
  top: { alignItems: "center", paddingTop: 30, paddingHorizontal: 20 },
  lockCircle: { width: 72, height: 72, borderRadius: 20, backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center" },
  lockText: { fontSize: 30 },
  title: { color: "#fff", fontSize: 24, fontWeight: "900", marginTop: 18, textAlign: "center" },
  body: { color: "#B5B5B5", fontSize: 14, marginTop: 10, textAlign: "center", lineHeight: 20 },
  dots: { flexDirection: "row", gap: 22, alignSelf: "center", marginTop: 30 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#3D3D3D" },
  dotFilled: { backgroundColor: "#E1BEE7" },
  dotErr: { backgroundColor: "#FF5252" },
  err: { color: "#FF7A7A", textAlign: "center", marginTop: 12, fontSize: 13, fontWeight: "700" },
  pad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  plainKey: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  numText: { color: "#fff", fontSize: 32, fontWeight: "500" },
  delText: { color: "#8E8E93", fontSize: 24 },
  footer: { paddingBottom: 8, paddingHorizontal: 16 },
  footerText: { color: "#7A7A7A", fontSize: 12, textAlign: "center", lineHeight: 18 },
  recoverLink: { color: "#E1BEE7", fontSize: 13, fontWeight: "800", textAlign: "center", marginTop: 12 },
  recoverBox: { backgroundColor: "#101010", borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 14, padding: 16 },
  recoverTitle: { color: "#fff", fontSize: 15, fontWeight: "900", textAlign: "center" },
  recoverInput: { backgroundColor: "#1A1A1A", color: "#fff", fontSize: 16, textAlign: "center", padding: 12, borderRadius: 10, marginTop: 12, borderWidth: 1, borderColor: "#2A2A2A" },
  recoverBtn: { backgroundColor: "#8E24AA", padding: 13, borderRadius: 999, alignItems: "center", marginTop: 12 },
  recoverBtnText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  recoverCancel: { color: "#8E8E93", fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: 12 },
});
