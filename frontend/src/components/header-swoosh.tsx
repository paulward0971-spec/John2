// Smooth glossy purple wave under the home header, flowing into the black
// content below — matches the sleek AIB wave artwork.
import React from "react";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";

export function HeaderSwoosh({ width = 420, height = 130 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 420 130" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="deep" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#9A2FB5" />
          <Stop offset="1" stopColor="#5F1478" />
        </LinearGradient>
        <LinearGradient id="gloss" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#F0CBF9" stopOpacity="0.95" />
          <Stop offset="0.45" stopColor="#C77DDA" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#8E24AA" stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#F3DAFB" stopOpacity="0.6" />
          <Stop offset="1" stopColor="#B24DD1" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Purple field with a smooth wavy lower edge */}
      <Path d="M0,0 L420,0 L420,86 C320,42 250,110 150,94 C90,84 40,58 0,74 Z" fill="url(#deep)" />

      {/* Glossy crest ribbon sweeping across */}
      <Path d="M-10,62 C 120,104 250,26 430,72 L430,94 C 250,50 120,120 -10,84 Z" fill="url(#gloss)" />

      {/* Soft light sheen lower-left */}
      <Path d="M-10,74 C 90,100 180,82 270,90 L270,104 C 180,98 90,114 -10,94 Z" fill="url(#sheen)" />

      {/* Black settles at the very bottom with a wavy top edge */}
      <Path d="M0,82 C 130,122 300,60 420,98 L420,130 L0,130 Z" fill="#000000" />
    </Svg>
  );
}
