// Small rounded bank-logo tile driven by the backend `slug` returned from
// /api/detect-bank. When a slug matches a known bank we show its brand mark
// on a white rounded tile; unknown / non-Irish IBANs fall back to a neutral
// bank icon so the UI never looks empty.
import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Image } from "expo-image";
import Svg, { Path, Rect } from "react-native-svg";
import { colors } from "@/src/theme";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGOS: Record<string, number> = {
  aib: require("../../assets/images/banks/aib.png"),
  boi: require("../../assets/images/banks/boi.png"),
  ptsb: require("../../assets/images/banks/ptsb.png"),
  ebs: require("../../assets/images/banks/ebs.png"),
  ulster: require("../../assets/images/banks/ulster.png"),
  anpost: require("../../assets/images/banks/anpost.png"),
  revolut: require("../../assets/images/banks/revolut.png"),
  n26: require("../../assets/images/banks/n26.png"),
  monzo: require("../../assets/images/banks/monzo.png"),
  bunq: require("../../assets/images/banks/bunq.png"),
};

// Some logos already have a strong background of their own — for those the
// wrapper tile is transparent so we don't get an ugly white rectangle inside
// a coloured brand tile.
const HAS_OWN_BACKGROUND: Record<string, boolean> = {
  aib: true,
  boi: true,
  ptsb: true,
  ebs: true,
  ulster: true,
  anpost: true,
  monzo: true,
  bunq: true,
  n26: false,
  revolut: false,
};

type Props = { slug?: string | null; size?: number; style?: StyleProp<ViewStyle> };

function GenericBank({ size }: { size: number }) {
  const s = size * 0.6;
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M3 10 L12 4 L21 10 L21 11 L3 11 Z" fill={colors.muted} />
      <Rect x="5" y="12" width="2" height="7" fill={colors.muted} />
      <Rect x="9" y="12" width="2" height="7" fill={colors.muted} />
      <Rect x="13" y="12" width="2" height="7" fill={colors.muted} />
      <Rect x="17" y="12" width="2" height="7" fill={colors.muted} />
      <Rect x="3" y="20" width="18" height="1.6" fill={colors.muted} />
    </Svg>
  );
}

export function BankLogo({ slug, size = 32, style }: Props) {
  const src = slug ? LOGOS[slug] : undefined;
  const hasOwnBg = slug ? HAS_OWN_BACKGROUND[slug] === true : false;
  const bg = hasOwnBg ? "transparent" : "#fff";
  const border = hasOwnBg ? "transparent" : colors.border;
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.26),
          backgroundColor: bg,
          borderColor: border,
        },
        style,
      ]}
      accessibilityLabel={`Bank logo${slug ? ` ${slug}` : ""}`}
    >
      {src ? (
        <Image
          source={src}
          style={{
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.26),
          }}
          contentFit="cover"
          transition={0}
        />
      ) : (
        <GenericBank size={size} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
  },
});
