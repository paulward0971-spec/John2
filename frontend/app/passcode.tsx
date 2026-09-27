// Personal Access Code (PAC) screen — matches AIB's real PAC unlock:
// black background, "Personal Access Code (PAC)" title with back button,
// six small dots, plain-text numpad, Forgot your PAC? bottom-left.
// Any 6-digit code unlocks.
//
// Biometrics (Face ID / fingerprint):
//   - First unlock ever: after the passcode passes we ask "Enable Face ID?".
//     Choice is saved in secure storage.
//   - Returning user with biometric enabled: we auto-prompt on mount and show
//     a "Face ID" chip in the footer to re-trigger.
//   - Choice is toggleable from Settings.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as LocalAuth from "expo-local-authentication";
import Svg, { Path } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { storage } from "@/src/utils/storage";

const PAC_LENGTH = 6;
const BIO_KEY = "aib.biometric.enabled"; // "1" | "0"
const BIO_LABEL_KEY = "aib.biometric.label"; // "face" | "finger"
const { width, height } = Dimensions.get("window");
const KEY_WIDTH = (width - 32) / 3;
const KEY_HEIGHT = Math.min(90, (height * 0.5) / 4);

const KEYS: (string | null)[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", null, "0", "del"];

function BackChevron() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 L8 12 L15 19" stroke="#E1BEE7" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
function DelIcon() {
  return (
    <Svg width={28} height={22} viewBox="0 0 32 22" fill="none">
      <Path d="M11 1 L2 11 L11 21 L30 21 L30 1 Z" stroke="#8E8E93" strokeWidth={1.8} strokeLinejoin="round" fill="none" />
      <Path d="M16 7 L24 15 M24 7 L16 15" stroke="#8E8E93" strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function FaceIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 8 V5 A1 1 0 0 1 5 4 H8 M16 4 H19 A1 1 0 0 1 20 5 V8 M20 16 V19 A1 1 0 0 1 19 20 H16 M8 20 H5 A1 1 0 0 1 4 19 V16" stroke="#E1BEE7" strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M9 10 V11 M15 10 V11" stroke="#E1BEE7" strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M9 15 C 10 16, 14 16, 15 15" stroke="#E1BEE7" strokeWidth={1.8} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
function FingerIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M8 6 C 10 4, 14 4, 16 6 C 18 8, 18 12, 17 15 M6 9 C 6 12, 6 16, 8 19 M10 8 C 11 8, 13 8, 14 9 C 15 11, 15 14, 14 17 M12 10 V16" stroke="#E1BEE7" strokeWidth={1.8} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export default function PasscodePAC() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState("");
  const [hardwareBio, setHardwareBio] = useState<"face" | "finger" | null>(null);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [askEnable, setAskEnable] = useState(false);
  const shake = useSharedValue(0);

  // On mount: figure out what hardware supports, whether user has opted in,
  // and auto-prompt if opted in.
  useEffect(() => {
    (async () => {
      try {
        // Skip biometrics entirely on web (no such API in browsers).
        if (Platform.OS === "web") return;
        const has = await LocalAuth.hasHardwareAsync();
        const enrolled = await LocalAuth.isEnrolledAsync();
        if (!has || !enrolled) return;
        const types = await LocalAuth.supportedAuthenticationTypesAsync();
        const face = types.includes(LocalAuth.AuthenticationType.FACIAL_RECOGNITION);
        const label: "face" | "finger" = face ? "face" : "finger";
        setHardwareBio(label);
        await storage.secureSet(BIO_LABEL_KEY, label);

        const enabled = await storage.secureGet<string>(BIO_KEY, "0");
        if (enabled === "1") {
          setBioEnabled(true);
          tryBiometric();
        }
      } catch {}
    })();
  }, []);

  const tryBiometric = async () => {
    try {
      const r = await LocalAuth.authenticateAsync({
        promptMessage: "Unlock AIB",
        cancelLabel: "Use PAC",
        disableDeviceFallback: true,
      });
      if (r.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.replace("/(tabs)");
      }
    } catch {}
  };

  const finishUnlock = () => {
    // If hardware is present and user hasn't chosen yet, ask them.
    if (hardwareBio && !bioEnabled && !askEnable) {
      setAskEnable(true);
      return;
    }
    router.replace("/(tabs)");
  };

  const enableBiometric = async () => {
    try {
      // Prompt once to prove enrolment before saving the preference.
      const r = await LocalAuth.authenticateAsync({
        promptMessage: `Enable ${hardwareBio === "face" ? "Face ID" : "Fingerprint"} for AIB`,
        cancelLabel: "Not now",
        disableDeviceFallback: true,
      });
      if (r.success) {
        await storage.secureSet(BIO_KEY, "1");
        setBioEnabled(true);
      }
    } catch {}
    router.replace("/(tabs)");
  };

  const skipBiometric = async () => {
    await storage.secureSet(BIO_KEY, "0");
    router.replace("/(tabs)");
  };

  const press = (v: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (v === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= PAC_LENGTH) return;
    const next = pin + v;
    setPin(next);
    if (next.length === PAC_LENGTH) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(finishUnlock, 260);
    }
  };

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  // Ask-to-enable overlay
  if (askEnable && hardwareBio) {
    const nice = hardwareBio === "face" ? "Face ID" : "Fingerprint";
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.enrollCenter}>
          <View style={styles.enrollIcon}>
            {hardwareBio === "face" ? <FaceIcon /> : <FingerIcon />}
          </View>
          <Text style={styles.enrollTitle}>Sign in faster with {nice}?</Text>
          <Text style={styles.enrollBody}>
            Next time you open AIB you can unlock instantly with {nice} instead of your PAC. You can turn this off any time in Settings.
          </Text>
          <Pressable style={styles.enrollPrimary} onPress={enableBiometric} testID="enroll-bio-yes">
            <Text style={styles.enrollPrimaryText}>Use {nice}</Text>
          </Pressable>
          <Pressable style={styles.enrollSecondary} onPress={skipBiometric} testID="enroll-bio-skip">
            <Text style={styles.enrollSecondaryText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]} testID="pac-screen">
      <View style={styles.topBar}>
        <Pressable
          onPress={bioEnabled ? tryBiometric : () => router.back()}
          style={styles.backBtn}
          testID="pac-back"
        >
          <BackChevron />
        </Pressable>
        <Text style={styles.title}>Personal Access Code (PAC)</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.dotsWrap}>
        <Animated.View style={[styles.dots, shakeStyle]}>
          {Array.from({ length: PAC_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i < pin.length && styles.dotFilled]}
              testID={`pac-dot-${i}`}
            />
          ))}
        </Animated.View>
      </View>

      <View style={styles.pad}>
        {KEYS.map((k, i) => (
          <View key={i} style={{ width: KEY_WIDTH, height: KEY_HEIGHT, alignItems: "center", justifyContent: "center" }}>
            {k === null ? (
              <View />
            ) : k === "del" ? (
              <Pressable onPress={() => press("del")} style={styles.plainKey} testID="pac-key-del">
                <DelIcon />
              </Pressable>
            ) : (
              <Pressable onPress={() => press(k)} style={styles.plainKey} testID={`pac-key-${k}`}>
                <Text style={styles.numText}>{k}</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Pressable testID="pac-forgot">
          <Text style={styles.forgotText}>Forgot your Personal{"\n"}Access Code?</Text>
        </Pressable>
        {bioEnabled && hardwareBio ? (
          <Pressable onPress={tryBiometric} testID="pac-bio" style={styles.bioBtn}>
            {hardwareBio === "face" ? <FaceIcon /> : <FingerIcon />}
            <Text style={styles.bioText}>{hardwareBio === "face" ? "Face ID" : "Fingerprint"}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000", paddingHorizontal: 16, justifyContent: "space-between" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center" },
  title: { color: "#FFFFFF", fontSize: 16, fontWeight: "800", textAlign: "center", flex: 1 },
  dotsWrap: { alignItems: "center", marginTop: 30 },
  dots: { flexDirection: "row", gap: 22 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#3D3D3D" },
  dotFilled: { backgroundColor: "#E1BEE7" },
  pad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  plainKey: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  numText: { color: "#FFFFFF", fontSize: 32, fontWeight: "500" },
  footer: { paddingBottom: 12, paddingHorizontal: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  forgotText: { color: "#E1BEE7", fontSize: 20, fontWeight: "800", lineHeight: 26 },
  bioBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#1A1A1A", borderRadius: 999 },
  bioText: { color: "#E1BEE7", fontSize: 14, fontWeight: "800" },

  enrollCenter: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  enrollIcon: { width: 84, height: 84, borderRadius: 24, backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  enrollTitle: { color: "#fff", fontSize: 26, fontWeight: "900", textAlign: "center" },
  enrollBody: { color: "#B5B5B5", fontSize: 15, textAlign: "center", marginTop: 12, lineHeight: 22 },
  enrollPrimary: { marginTop: 30, backgroundColor: "#8E24AA", paddingVertical: 16, paddingHorizontal: 40, borderRadius: 999, alignSelf: "stretch", alignItems: "center" },
  enrollPrimaryText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  enrollSecondary: { marginTop: 10, paddingVertical: 14, alignSelf: "stretch", alignItems: "center" },
  enrollSecondaryText: { color: "#E1BEE7", fontSize: 15, fontWeight: "700" },
});
