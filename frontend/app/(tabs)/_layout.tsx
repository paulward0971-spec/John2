// Bottom tab navigation
import React from "react";
import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Rect, Circle, Line } from "react-native-svg";

import { colors } from "@/src/theme";

type IconProps = { color: string; size?: number };

const Icons = {
  home: ({ color, size = 24 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 11 L12 4 L20 11 V20 A1 1 0 0 1 19 21 H14 V15 H10 V21 H5 A1 1 0 0 1 4 20 Z" stroke={color} strokeWidth={2} strokeLinejoin="round" fill="none" />
    </Svg>
  ),
  insights: ({ color, size = 24 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="12" width="3" height="8" fill={color} rx="1" />
      <Rect x="10.5" y="6" width="3" height="14" fill={color} rx="1" />
      <Rect x="17" y="9" width="3" height="11" fill={color} rx="1" />
    </Svg>
  ),
  payments: ({ color, size = 24 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 8 H19 L16 5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M17 16 H5 L8 19" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  ),
  cards: ({ color, size = 24 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="6" width="18" height="13" rx="2" stroke={color} strokeWidth={2} fill="none" />
      <Line x1="3" y1="10" x2="21" y2="10" stroke={color} strokeWidth={2} />
    </Svg>
  ),
  products: ({ color, size = 24 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 8 L12 4 L20 8 L12 12 Z" stroke={color} strokeWidth={2} strokeLinejoin="round" fill="none" />
      <Path d="M4 12 L12 16 L20 12" stroke={color} strokeWidth={2} strokeLinejoin="round" fill="none" />
      <Path d="M4 16 L12 20 L20 16" stroke={color} strokeWidth={2} strokeLinejoin="round" fill="none" />
    </Svg>
  ),
};

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarItemStyle: { alignSelf: "center" },
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem} testID="tab-home">
              <Icons.home color={focused ? colors.onSurface : colors.muted} />
              <TabLabel label="Home" focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem} testID="tab-insights">
              <Icons.insights color={focused ? colors.onSurface : colors.muted} />
              <TabLabel label="Insights" focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem} testID="tab-payments">
              <Icons.payments color={focused ? colors.onSurface : colors.muted} />
              <TabLabel label="Payments" focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem} testID="tab-cards">
              <Icons.cards color={focused ? colors.onSurface : colors.muted} />
              <TabLabel label="Cards" focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem} testID="tab-products">
              <Icons.products color={focused ? colors.onSurface : colors.muted} />
              <TabLabel label="Products" focused={focused} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#000000",
    borderTopColor: colors.border,
    borderTopWidth: 0.5,
    height: 80,
    paddingTop: 8,
  },
  tabItem: { alignItems: "center", justifyContent: "center", width: 68, gap: 4 },
  tabLabel: { color: colors.muted, fontSize: 11, fontWeight: "500" },
  tabLabelActive: { color: colors.onSurface, fontWeight: "700" },
});
