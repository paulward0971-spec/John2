// Cards tab — matches the AIB debit card screenshot exactly
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import Svg, { Path, Circle, Rect, Defs, LinearGradient as SvgLg, Stop, Line } from "react-native-svg";

import { colors, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { AibLogo } from "@/src/components/aib-logo";

function Snowflake({ size = 26, color = "#fff" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2 V22 M2 12 H22 M5 5 L19 19 M19 5 L5 19" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function Hash({ size = 26, color = "#fff" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 3 L7 21 M17 3 L15 21 M4 9 H21 M3 15 H20" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function DotsMenu({ size = 26, color = "#fff" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="5" r="1.6" fill={color} />
      <Circle cx="12" cy="12" r="1.6" fill={color} />
      <Circle cx="12" cy="19" r="1.6" fill={color} />
    </Svg>
  );
}
function IceCrystal({ size = 60, color = "#B3E5FC" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60" fill="none">
      <Path d="M30 4 V56 M4 30 H56 M10 10 L50 50 M50 10 L10 50" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M26 8 L30 4 L34 8 M26 52 L30 56 L34 52 M8 26 L4 30 L8 34 M52 26 L56 30 L52 34" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// Card face artwork — layered purple chevron swoosh over a white base,
// matching the AIB debit card design. Switches to icy blues when frozen.
function CardArt({ frozen }: { frozen: boolean }) {
  const layers = frozen
    ? [
        { t: 20, c: "#E1F5FE" }, { t: 68, c: "#81D4FA" }, { t: 116, c: "#4FC3F7" },
        { t: 164, c: "#29B6F6" }, { t: 212, c: "#0288D1" },
      ]
    : [
        { t: 20, c: "#EED4F5" }, { t: 68, c: "#CE93D8" }, { t: 116, c: "#AB47BC" },
        { t: 164, c: "#8E24AA" }, { t: 212, c: "#5F1478" },
      ];
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 320 200" preserveAspectRatio="none">
      <Rect x="0" y="0" width="320" height="200" fill="#F6F4F7" />
      {/* faint diagonal "sheet" folds on the white left side */}
      <Path d="M-20 78 L180 8" stroke="#E7E3EA" strokeWidth={12} opacity={0.7} strokeLinecap="round" />
      <Path d="M-20 128 L160 46" stroke="#ECE9EE" strokeWidth={9} opacity={0.6} strokeLinecap="round" />
      {/* nested left-pointing chevrons, light -> dark */}
      {layers.map((l, i) => (
        <Path key={i} d={`M320 0 L${l.t + 95} 0 L${l.t} 100 L${l.t + 95} 200 L320 200 Z`} fill={l.c} />
      ))}
    </Svg>
  );
}

export default function Cards() {
  const insets = useSafeAreaInsets();
  const [frozen, setFrozen] = useState(false);
  const profile = useQuery({ queryKey: ["profile"], queryFn: api.getProfile });
  const initials = (profile.data?.account_holder || "J G")
    .split(" ").map((p: string) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }} testID="cards-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          <Text style={styles.topTitle}>Debit-{profile.data?.card_last4 || "4412"}</Text>
          <View style={styles.helpBtn}><Text style={{ color: "#fff", fontWeight: "800" }}>?</Text></View>
        </View>

        {/* The card */}
        <View style={styles.cardWrap}>
          <View style={styles.card}>
            {/* User's exact card artwork */}
            <Image
              source={require("../../assets/images/card-user.png")}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
            {/* Frozen overlay */}
            {frozen && (
              <View style={styles.frozenOverlay} pointerEvents="none">
                <IceCrystal size={72} />
                <Text style={styles.frozenText}>Card frozen</Text>
              </View>
            )}
          </View>

          <Text style={styles.accountUnder}>{profile.data?.account_label || "AIB BANK ACCOUNT-017"}</Text>

          <View style={styles.actions}>
            <View style={{ alignItems: "center" }}>
              <Pressable
                style={[styles.actionBtn, frozen && { backgroundColor: "#0288D1" }]}
                onPress={() => setFrozen((f) => !f)}
                testID="card-freeze"
              >
                <Snowflake size={28} color="#fff" />
              </Pressable>
              <Text style={styles.actionLabel}>{frozen ? "Unfreeze" : "Freeze"}</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Pressable style={[styles.actionBtn, frozen && { opacity: 0.4 }]} disabled={frozen} testID="card-pin"><Hash size={28} color="#fff" /></Pressable>
              <Text style={styles.actionLabel}>Show PIN</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Pressable style={styles.actionBtnDark} testID="card-more"><DotsMenu size={28} color="#fff" /></Pressable>
              <Text style={styles.actionLabel}>More</Text>
            </View>
          </View>

          {frozen && (
            <View style={styles.frozenBanner} testID="frozen-banner">
              <Text style={styles.frozenBannerTitle}>This card is frozen</Text>
              <Text style={styles.frozenBannerBody}>Payments and cash withdrawals will be declined. Tap Unfreeze to reactivate.</Text>
            </View>
          )}
        </View>

        <View style={styles.detail}>
          <Detail label="Card holder" value={profile.data?.card_holder || "John Guilfoyle"} />
          <Detail label="Expires" value={profile.data?.card_expiry || "07/29"} />
          <Detail label="Card number" value={`•••• •••• •••• ${profile.data?.card_last4 || "4412"}`} />
        </View>
      </ScrollView>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  topTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  helpBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  cardWrap: { alignItems: "center", marginTop: 8 },
  card: { width: "88%", aspectRatio: 1.6, borderRadius: 20, overflow: "hidden", backgroundColor: "#000" },
  visa: { color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: 2 },
  visaSub: { color: "#fff", fontSize: 14, fontWeight: "600" },
  cardFold: { position: "absolute", left: -60, bottom: -40, width: 260, height: 260, backgroundColor: "rgba(255,255,255,0.35)", transform: [{ rotate: "-25deg" }], borderRadius: 30 },
  frozenOverlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(179,229,252,0.28)" },
  frozenText: { color: "#01579B", fontSize: 20, fontWeight: "900", marginTop: 6, letterSpacing: 1 },
  frozenBanner: { marginTop: 18, marginHorizontal: 16, padding: 14, borderRadius: 12, backgroundColor: "rgba(2,136,209,0.15)", borderLeftWidth: 3, borderLeftColor: "#03A9F4", alignSelf: "stretch" },
  frozenBannerTitle: { color: "#03A9F4", fontSize: 14, fontWeight: "800" },
  frozenBannerBody: { color: "#B3E5FC", fontSize: 13, marginTop: 6, lineHeight: 18 },
  accountUnder: { color: colors.muted, marginTop: 20, fontSize: 14, fontWeight: "700", letterSpacing: 0.5 },
  actions: { flexDirection: "row", gap: 20, marginTop: 22 },
  actionBtn: { width: 60, height: 60, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  actionBtnDark: { width: 60, height: 60, borderRadius: 16, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  actionLabel: { color: "#fff", fontSize: 14, fontWeight: "700", marginTop: 6 },
  detail: { marginTop: 28, marginHorizontal: 16, backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 4 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  detailLabel: { color: colors.muted, fontSize: 14 },
  detailValue: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
