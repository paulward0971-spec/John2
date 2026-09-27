// AIB Ark logo — bird perched on a scale/ark hull with mast + crossbar,
// all in white on a purple gradient rounded square. "AIB" wordmark inside
// the tile below the mark.
import React from "react";
import Svg, {
  Rect,
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Ellipse,
  Text as SvgText,
} from "react-native-svg";

type Props = { size?: number; showText?: boolean; radius?: number };

export function AibLogo({ size = 120, showText = true, radius = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="aibBg" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor="#5B1470" />
          <Stop offset="1" stopColor="#A036BE" />
        </LinearGradient>
      </Defs>

      {/* Rounded purple tile */}
      <Rect x="0" y="0" width="200" height="200" rx={radius * (200 / size)} fill="url(#aibBg)" />

      {/* ---- ARK HULL (bottom scale-like shape with upturned tips) ---- */}
      {/* Outer hull filled white, inner cutout keeps it as a ring */}
      <Path
        d="
          M 40 105
          C 40 100, 46 96, 54 96
          L 146 96
          C 154 96, 160 100, 160 105
          L 160 110
          C 160 132, 138 148, 100 148
          C 62 148, 40 132, 40 110
          Z
        "
        fill="#FFFFFF"
      />
      {/* Inner cutout to make it hollow (ring / bowl shape) */}
      <Path
        d="
          M 50 108
          C 52 106, 58 105, 64 105
          L 136 105
          C 142 105, 148 106, 150 108
          L 150 111
          C 150 128, 132 140, 100 140
          C 68 140, 50 128, 50 111
          Z
        "
        fill="url(#aibBg)"
      />

      {/* Upturned left tip of ark */}
      <Path
        d="M 34 108
           C 30 96, 34 86, 44 86
           L 44 96
           C 40 96, 38 100, 38 104
           Z"
        fill="#FFFFFF"
      />
      {/* Upturned right tip of ark */}
      <Path
        d="M 166 108
           C 170 96, 166 86, 156 86
           L 156 96
           C 160 96, 162 100, 162 104
           Z"
        fill="#FFFFFF"
      />

      {/* ---- MAST (vertical bar) ---- */}
      <Rect x="97" y="52" width="6" height="50" fill="#FFFFFF" />
      {/* ---- CROSSBAR (horizontal bar across mast) ---- */}
      <Rect x="76" y="78" width="48" height="6" fill="#FFFFFF" />

      {/* ---- BIRD ---- */}
      {/* Main body (rounded, slightly angled) */}
      <Path
        d="M 66 62
           C 66 52, 78 46, 96 46
           L 122 46
           C 132 46, 138 50, 138 58
           C 138 66, 132 70, 122 70
           L 78 70
           C 70 70, 66 66, 66 62 Z"
        fill="#FFFFFF"
      />
      {/* Bird head bump (right side, slightly higher) */}
      <Ellipse cx="132" cy="52" rx="10" ry="9" fill="#FFFFFF" />
      {/* Small beak notch */}
      <Path d="M 140 52 L 148 50 L 144 57 Z" fill="#FFFFFF" />
      {/* Eye */}
      <Circle cx="134" cy="50" r="1.6" fill="#5B1470" />
      {/* Tail feather triangle (left side) */}
      <Path d="M 60 58 L 68 54 L 68 66 Z" fill="#FFFFFF" />
      {/* Wing hint (curved line) */}
      <Path
        d="M 84 54 C 96 50, 112 50, 122 56"
        stroke="#5B1470"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        opacity="0.35"
      />

      {/* ---- AIB wordmark inside the tile ---- */}
      {showText && (
        <SvgText
          x="100"
          y="180"
          fontSize="30"
          fontWeight="900"
          fill="#FFFFFF"
          textAnchor="middle"
          fontFamily="Helvetica"
          letterSpacing="1"
        >
          AIB
        </SvgText>
      )}
    </Svg>
  );
}
