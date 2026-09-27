// Home screen — purple header with greeting, standing-orders card,
// category filter chips, account card, activity list.
import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Svg, { Path, Rect, Circle } from "react-native-svg";

import { colors, spacing, radius } from "@/src/theme";
import { api, formatEuros } from "@/src/api";
import { PurpleWave } from "@/src/components/purple-wave";
import { HeaderSwoosh } from "@/src/components/header-swoosh";

const CHIPS = ["All", "Everyday", "Savings", "Invest", "Loans"];

function Icon({ name, size = 22, color = "#fff" }: { name: string; size?: number; color?: string }) {
  // small custom SVG icons for merchants + header
  if (name === "help") return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M9.5 9 A2.5 2.5 0 0 1 14.5 9 C14.5 11 12 11 12 13" stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <Circle cx="12" cy="17" r="1" fill={color} />
    </Svg>
  );
  if (name === "bell") return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 16 V11 A6 6 0 0 1 18 11 V16 L20 18 H4 Z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" fill="none" />
      <Path d="M10 20 A2 2 0 0 0 14 20" stroke={color} strokeWidth={1.6} fill="none" />
    </Svg>
  );
  if (name === "cart") return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5 H6 L8 17 H19 L21 8 H7" stroke={color} strokeWidth={1.6} strokeLinejoin="round" fill="none" />
      <Circle cx="9" cy="20" r="1.2" fill={color} />
      <Circle cx="18" cy="20" r="1.2" fill={color} />
    </Svg>
  );
  if (name === "music") return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M10 18 V6 L18 4 V16" stroke={color} strokeWidth={1.6} strokeLinejoin="round" fill="none" />
      <Circle cx="8" cy="18" r="2" stroke={color} strokeWidth={1.6} fill="none" />
      <Circle cx="16" cy="16" r="2" stroke={color} strokeWidth={1.6} fill="none" />
    </Svg>
  );
  if (name === "briefcase") return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="7" width="18" height="13" rx="2" stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M9 7 V5 A1 1 0 0 1 10 4 H14 A1 1 0 0 1 15 5 V7" stroke={color} strokeWidth={1.6} fill="none" />
    </Svg>
  );
  if (name === "bus") return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="4" width="16" height="14" rx="2" stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M4 12 H20" stroke={color} strokeWidth={1.6} />
      <Circle cx="8" cy="19" r="1.2" fill={color} />
      <Circle cx="16" cy="19" r="1.2" fill={color} />
    </Svg>
  );
  if (name === "calendar") return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M3 10 H21 M8 3 V7 M16 3 V7" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
  if (name === "arrow-up") return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20 V4 M6 10 L12 4 L18 10" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
  return null;
}

const iconMap: Record<string, string> = {
  "cart-outline": "cart",
  "musical-notes-outline": "music",
  "briefcase-outline": "briefcase",
  "bus-outline": "bus",
  "logo-google-playstore": "cart",
  "arrow-up-outline": "arrow-up",
};

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [chip, setChip] = useState("Everyday");
  const [showStandingCard, setShowStandingCard] = useState(true);
  const profile = useQuery({ queryKey: ["profile"], queryFn: api.getProfile });
  const txns = useQuery({ queryKey: ["txns"], queryFn: api.listTransactions });

  // Refetch balance + activity every time Home comes back into focus, so that
  // returning from a completed transfer immediately reflects the new balance.
  useFocusEffect(
    useCallback(() => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["txns"] });
    }, [qc]),
  );

  const initials = useMemo(() => {
    const name = profile.data?.account_holder || "J G";
    return name.split(" ").map((p: string) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  }, [profile.data]);

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }} testID="home-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Purple header */}
        <LinearGradient
          colors={["#8E24AA", "#A03CBB", "#8E24AA"]}
          style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 20 }}
        >
          <View style={styles.topRow}>
            <Pressable onPress={() => router.push("/settings")} style={styles.avatar} testID="open-settings">
              <Text style={styles.avatarText}>{initials}</Text>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 18 }}>
              <Pressable testID="home-help" onPress={() => router.push("/help")}><Icon name="help" size={24} color="#fff" /></Pressable>
              <Pressable testID="home-bell"><Icon name="bell" size={24} color="#fff" /></Pressable>
            </View>
          </View>
          <Text style={styles.hi}>Hi {profile.data?.display_name || "John"}</Text>
          <Text style={styles.subHi}>
            You've spent {formatEuros(profile.data?.monthly_spent_cents || 0).replace("-", "")} this month
          </Text>

          {/* Promo card */}
          {showStandingCard && (
            <View style={styles.promo}>
              <Pressable onPress={() => setShowStandingCard(false)} style={styles.promoClose} hitSlop={12} testID="dismiss-standing">
                <Text style={styles.promoCloseText}>✕</Text>
              </Pressable>
              <View style={styles.promoIcon}>
                <Icon name="calendar" size={26} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.promoTitle}>Manage your standing orders</Text>
                <Text style={styles.promoBody}>You can set up, change and cancel standing orders in the app.</Text>
                <Pressable style={styles.promoBtn} onPress={() => router.push("/(tabs)/payments")} testID="promo-more">
                  <Text style={styles.promoBtnText}>More</Text>
                </Pressable>
              </View>
            </View>
          )}
        </LinearGradient>
        {/* Wave under header — smooth glossy swoosh flowing into black */}
        <View style={{ marginTop: -1 }}>
          <HeaderSwoosh width={420} height={120} />
        </View>

        {/* Chip filter row (sticky-ish; kept as chrome above list) */}
        <View style={styles.chipWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {CHIPS.map((c) => {
              const active = c === chip;
              return (
                <Pressable
                  key={c}
                  onPress={() => setChip(c)}
                  style={[styles.chip, active && styles.chipActive]}
                  testID={`chip-${c.toLowerCase()}`}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Account card */}
        <View style={styles.accountCard} testID="account-card">
          <View style={styles.accountHead}>
            <Text style={styles.accountLabel}>{profile.data?.account_label || "AIB BANK ACCOUNT-017"}</Text>
            <Pressable onPress={() => router.push("/settings")} testID="account-more">
              <Text style={styles.dots}>⋮</Text>
            </Pressable>
          </View>
          <Text style={styles.balance}>{formatEuros(profile.data?.balance_cents || 0)}</Text>
          <Text style={styles.available}>{formatEuros(profile.data?.available_cents || 0)} available</Text>
          <View style={styles.hairline} />
          <Pressable style={styles.openBtn} onPress={() => router.push("/transfer/new")} testID="open-transfer">
            <Text style={styles.openBtnText}>Send money</Text>
          </Pressable>
        </View>

        {/* Activity */}
        <View style={styles.activityHead}>
          <Text style={styles.activityTitle}>Activity</Text>
        </View>
        <View style={styles.activityCard}>
          {(txns.data || []).slice(0, 5).map((t: any, i: number) => (
            <Pressable
              key={t.id}
              style={[styles.txnRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: "#1F1F1F" }]}
              onPress={() => router.push({ pathname: "/transaction/[id]", params: { id: t.id } })}
              testID={`txn-${t.id}`}
            >
              <View style={styles.txnIcon}>
                <Icon name={iconMap[t.icon] || "cart"} color="#fff" size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txnMerchant}>{t.merchant}</Text>
                <Text style={styles.txnMeta}>
                  {new Date(t.date).toLocaleDateString("en-IE", { day: "2-digit", month: "short" })} • {profile.data?.account_label?.slice(0, 12) || "AIB BANK A"}...
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={[
                    styles.txnAmount,
                    t.status === "declined" && styles.txnAmountDeclined,
                    t.amount_cents > 0 && styles.txnAmountCredit,
                  ]}
                >
                  {formatEuros(t.amount_cents)}
                </Text>
                {t.status === "declined" && <Text style={styles.txnDeclined}>Declined</Text>}
              </View>
            </Pressable>
          ))}
          {(txns.data || []).length > 5 && (
            <Pressable style={styles.seeAll} testID="see-all-txns">
              <Text style={styles.seeAllText}>See all</Text>
            </Pressable>
          )}
        </View>

        {/* Zippay promo */}
        <Pressable style={styles.zippay} testID="zippay-promo" onPress={() => router.push("/transfer/new")}>
          <View style={styles.zippayIcon}>
            <Icon name="arrow-up" color="#fff" size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.zippayTitle}>Pay your contacts with Zippay</Text>
            <Text style={styles.zippayBody}>Pay, request or split payments</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  hi: { color: "#fff", fontSize: 40, fontWeight: "900", marginTop: 18 },
  subHi: { color: "#F1E5F5", fontSize: 15, marginTop: 6 },

  promo: { flexDirection: "row", gap: 12, backgroundColor: "rgba(0,0,0,0.35)", padding: 14, borderRadius: 18, marginTop: 22, position: "relative" },
  promoClose: { position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)", zIndex: 2 },
  promoCloseText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  promoIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#D64B7A", alignItems: "center", justifyContent: "center" },
  promoTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  promoBody: { color: "#EAD6F0", fontSize: 13, marginTop: 6, lineHeight: 18 },
  promoBtn: { marginTop: 10, backgroundColor: colors.brandTertiary, borderRadius: 999, paddingVertical: 10, alignItems: "center" },
  promoBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  chipWrap: { backgroundColor: "#000", paddingVertical: 10 },
  chipRow: { paddingHorizontal: 16, gap: 8 },
  chip: { paddingHorizontal: 18, height: 36, borderRadius: 999, backgroundColor: "transparent", justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: colors.brandTertiary },
  chipText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  chipTextActive: { color: "#fff", fontWeight: "800" },

  accountCard: { marginHorizontal: 16, backgroundColor: "#181818", borderRadius: 16, padding: 18, marginTop: 6 },
  accountHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  accountLabel: { color: colors.brandLight, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  dots: { color: colors.muted, fontSize: 22, fontWeight: "700" },
  balance: { color: "#fff", fontSize: 36, fontWeight: "900", marginTop: 12 },
  available: { color: colors.muted, fontSize: 14, marginTop: 4 },
  hairline: { height: 1, backgroundColor: colors.border, marginTop: 14, marginBottom: 4 },
  openBtn: { paddingVertical: 12, alignItems: "center" },
  openBtnText: { color: colors.brandLight, fontSize: 15, fontWeight: "700" },

  activityHead: { paddingHorizontal: 20, marginTop: 20 },
  activityTitle: { color: "#fff", fontSize: 22, fontWeight: "900", marginBottom: 12 },
  activityCard: { marginHorizontal: 16, backgroundColor: "#111", borderRadius: 16, paddingHorizontal: 8 },
  txnRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 8 },
  txnIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center" },
  txnMerchant: { color: "#fff", fontSize: 15, fontWeight: "700" },
  txnMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  txnAmount: { color: "#fff", fontSize: 15, fontWeight: "800" },
  txnAmountCredit: { color: colors.success },
  txnAmountDeclined: { color: "#fff", textDecorationLine: "line-through", opacity: 0.7 },
  txnDeclined: { color: colors.error, fontSize: 12, fontWeight: "700", marginTop: 2 },
  seeAll: { alignItems: "center", paddingVertical: 14, borderTopWidth: 0.5, borderTopColor: "#1F1F1F" },
  seeAllText: { color: colors.brandLight, fontSize: 15, fontWeight: "800" },
  zippay: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#111", padding: 16, borderRadius: 16, marginHorizontal: 16, marginTop: 16 },
  zippayIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  zippayTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  zippayBody: { color: colors.muted, fontSize: 13, marginTop: 4 },
  chev: { color: colors.muted, fontSize: 24 },
});
