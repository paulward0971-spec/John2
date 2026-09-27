// Help screen — "How can we help?" with Abi digital assistant card,
// Frequently asked questions, Find AIB branch, Contact us.
import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Defs, LinearGradient, Stop, Circle, G } from "react-native-svg";

import { colors } from "@/src/theme";

function AbiOrb({ size = 140 }) {
  // A stylised twisted-ring 3D-ish purple emblem drawn in SVG
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="orb1" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#C24BE0" />
          <Stop offset="1" stopColor="#7B1FA2" />
        </LinearGradient>
        <LinearGradient id="orb2" x1="1" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#B24DD1" />
          <Stop offset="1" stopColor="#4A0E5C" />
        </LinearGradient>
      </Defs>
      <G>
        <Path
          d="M100 30
             C 145 30, 170 60, 170 100
             C 170 140, 145 170, 100 170
             C 80 170, 65 158, 65 140
             C 65 120, 82 108, 100 108
             C 118 108, 130 96, 130 78
             C 130 60, 118 46, 100 46 Z"
          fill="url(#orb1)"
        />
        <Path
          d="M100 60
             C 128 60, 140 78, 140 100
             C 140 122, 122 138, 100 138
             C 90 138, 84 132, 84 122
             C 84 112, 92 106, 100 106
             C 116 106, 124 96, 124 82
             C 124 68, 116 60, 100 60 Z"
          fill="url(#orb2)"
          opacity="0.9"
        />
        <Circle cx="100" cy="100" r="18" fill="#000" opacity="0.85" />
      </G>
    </Svg>
  );
}

function Icon({ name, color = "#fff", size = 22 }: { name: string; color?: string; size?: number }) {
  if (name === "help") return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M9.5 9 A2.5 2.5 0 0 1 14.5 9 C14.5 11 12 11 12 13" stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <Circle cx="12" cy="17" r="1" fill={color} />
    </Svg>
  );
  if (name === "pin") return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2 C7 2, 4 6, 4 10 C4 15, 12 22, 12 22 C12 22, 20 15, 20 10 C20 6, 17 2, 12 2 Z" stroke={color} strokeWidth={1.6} fill="none" />
      <Circle cx="12" cy="10" r="3" stroke={color} strokeWidth={1.6} fill="none" />
    </Svg>
  );
  if (name === "phone") return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5 C4 4, 5 3, 6 3 L8 3 L10 8 L8 10 C9 13, 11 15, 14 16 L16 14 L21 16 L21 18 C21 19, 20 20, 19 20 C11 20, 4 13, 4 5 Z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" fill="none" />
    </Svg>
  );
  if (name === "chev") return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 5 L16 12 L9 19" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
  if (name === "back") return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 L8 12 L15 19" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
  return null;
}

export default function Help() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }} testID="help-screen">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, padding: 16, paddingBottom: 40 }}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="help-back">
          <Icon name="back" color="#E1BEE7" />
        </Pressable>

        <Text style={styles.h1}>How can we help?</Text>

        <View style={styles.abiCard}>
          <AbiOrb size={150} />
          <Text style={styles.abiHi}>Hi, I'm Abi, I'm your digital assistant.</Text>
          <Pressable style={styles.askBtn} onPress={() => router.push("/chat")} testID="ask-abi-btn">
            <Text style={styles.askBtnText}>Ask Abi</Text>
          </Pressable>
        </View>

        <View style={styles.linkList}>
          <Pressable style={styles.linkRow} testID="help-faq">
            <View style={styles.linkIcon}><Icon name="help" color="#fff" size={20} /></View>
            <Text style={styles.linkText}>Frequently asked questions</Text>
            <Icon name="chev" color={colors.muted} size={18} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.linkRow} testID="help-branch">
            <View style={styles.linkIcon}><Icon name="pin" color="#fff" size={20} /></View>
            <Text style={styles.linkText}>Find AIB branch</Text>
            <Icon name="chev" color={colors.muted} size={18} />
          </Pressable>
        </View>

        <Pressable style={styles.contact} testID="help-contact">
          <Icon name="phone" color="#E1BEE7" size={20} />
          <Text style={styles.contactText}>Contact us</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center", marginBottom: 10 },
  h1: { color: "#fff", fontSize: 34, fontWeight: "900", marginBottom: 22 },
  abiCard: { backgroundColor: "#0F0F0F", borderRadius: 20, paddingVertical: 26, paddingHorizontal: 20, alignItems: "center", borderWidth: 1, borderColor: "#1F1F1F" },
  abiHi: { color: "#fff", fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 8, lineHeight: 26 },
  askBtn: { marginTop: 20, backgroundColor: colors.brandPrimary, borderRadius: 999, paddingVertical: 16, alignItems: "center", alignSelf: "stretch" },
  askBtnText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  linkList: { backgroundColor: "#0F0F0F", borderRadius: 16, marginTop: 22, borderWidth: 1, borderColor: "#1F1F1F" },
  linkRow: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  linkIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  linkText: { color: "#fff", fontSize: 16, fontWeight: "800", flex: 1 },
  divider: { height: 1, backgroundColor: "#1F1F1F", marginHorizontal: 16 },
  contact: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center", marginTop: 22, paddingVertical: 10 },
  contactText: { color: "#E1BEE7", fontSize: 16, fontWeight: "800" },
});
