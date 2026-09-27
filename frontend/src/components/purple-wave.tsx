// Purple wave decoration used on splash + home header
import React from "react";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";

export function PurpleWave({ width = 400, height = 180 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 400 180" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="w1" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#B24DD1" stopOpacity="0.35" />
          <Stop offset="1" stopColor="#7B1FA2" stopOpacity="0.05" />
        </LinearGradient>
        <LinearGradient id="w2" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#E1BEE7" stopOpacity="0.45" />
          <Stop offset="1" stopColor="#7B1FA2" stopOpacity="0.1" />
        </LinearGradient>
      </Defs>
      <Path d="M0,120 C90,60 200,150 400,80 L400,180 L0,180 Z" fill="url(#w1)" />
      <Path d="M0,150 C120,90 240,170 400,110 L400,180 L0,180 Z" fill="url(#w2)" />
    </Svg>
  );
}
