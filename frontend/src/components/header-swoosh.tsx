// Purple swoosh wave under the header — matches the AIB curve exactly.
import React from "react";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";

export function HeaderSwoosh({ width = 420, height = 90 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 420 90" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="sw2" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#E4A0F1" stopOpacity="0.7" />
          <Stop offset="0.5" stopColor="#C77DDA" stopOpacity="0.6" />
          <Stop offset="1" stopColor="#8E24AA" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {/* Solid purple continuing block */}
      <Path d="M0,0 L420,0 L420,50 C300,10 120,80 0,40 Z" fill="#8E24AA" />
      {/* Lighter overlaid swoosh crest */}
      <Path d="M-10,40 C 120,80 260,15 430,50 L430,80 C 280,50 130,90 -10,70 Z" fill="url(#sw2)" />
    </Svg>
  );
}
