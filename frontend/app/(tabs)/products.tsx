import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/src/theme";

const PRODUCTS = [
  { id: "sav", title: "Online Saver", body: "1.50% variable p.a. Instant access.", tag: "Savings" },
  { id: "loan", title: "Personal Loan", body: "Borrow from €1,000. Fixed rate.", tag: "Loans" },
  { id: "mort", title: "Green Mortgage", body: "Discounted rate for BER A homes.", tag: "Mortgage" },
  { id: "inv", title: "Investment Funds", body: "Start investing with €100/mo.", tag: "Invest" },
];

export default function Products() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top + 12 }} testID="products-screen">
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Text style={styles.title}>Products</Text>
        <Text style={styles.sub}>Explore AIB products</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {PRODUCTS.map((p) => (
          <Pressable key={p.id} style={styles.card} testID={`product-${p.id}`}>
            <Text style={styles.tag}>{p.tag}</Text>
            <Text style={styles.pTitle}>{p.title}</Text>
            <Text style={styles.pBody}>{p.body}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: "#fff", fontSize: 32, fontWeight: "900" },
  sub: { color: colors.muted, marginTop: 4 },
  card: { backgroundColor: colors.surfaceSecondary, padding: 18, borderRadius: 16, marginBottom: 12 },
  tag: { color: colors.brandTertiary, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  pTitle: { color: "#fff", fontSize: 18, fontWeight: "900", marginTop: 6 },
  pBody: { color: colors.muted, fontSize: 13, marginTop: 6 },
});
