// AIB Demo Prototype - Dark theme with AIB purple accents.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  // Surfaces
  surface: "#0A0A0A",
  onSurface: "#FFFFFF",
  surfaceSecondary: "#161616",
  onSurfaceSecondary: "#F5F5F5",
  surfaceTertiary: "#1F1F1F",
  onSurfaceTertiary: "#E5E5E5",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#0A0A0A",
  muted: "#8E8E93",

  // Brand - AIB purple family (slightly lighter across the app)
  brand: "#8E24AA",
  onBrand: "#FFFFFF",
  brandPrimary: "#8E24AA", // AIB signature purple (lighter)
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#5F1478", // deep aubergine (splash/header wash)
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#C77DDA", // brighter magenta accent
  onBrandTertiary: "#FFFFFF",
  brandDeep: "#4A0E5C", // darker purple for gradient stops
  brandLight: "#EED4F5",

  // Status
  success: "#4CAF50",
  onSuccess: "#FFFFFF",
  warning: "#FFB74D",
  onWarning: "#0A0A0A",
  error: "#FF5252",
  onError: "#FFFFFF",
  info: "#64B5F6",
  onInfo: "#0A0A0A",

  // Lines
  border: "#2A2A2A",
  borderStrong: "#3D3D3D",
  divider: "#1F1F1F",
};

const light = dark; // App is dark-only per user spec; keep light key for RN plumbing.

export type ThemeColors = typeof dark;
export const defaultScheme = "dark" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}
setColorScheme?.("dark");

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = "dark";
  return { scheme, colors: themes[scheme] ?? dark };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const colors = dark;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };
