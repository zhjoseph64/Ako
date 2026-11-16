import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { colors } from "./theme";

export const AVATAR_PALETTES = [
  { label: "Orchid", c1: "#F0A9DC", c2: "#8E9BF0" },
  { label: "Lagoon", c1: "#9FD9E6", c2: "#4757C4" },
  { label: "Violet", c1: "#F6C8FF", c2: "#9C72EE" },
  { label: "Dawn", c1: "#FFD2B0", c2: "#E58FD0" },
];
export const AVATAR_FRAMES = [
  { key: "none", label: "No frame" },
  { key: "ring", label: "Ring" },
  { key: "gem", label: "Gem frame" },
];
export const AVATAR_AURAS = [
  { key: "none", label: "No aura" },
  { key: "halo", label: "Halo" },
  { key: "sparkles", label: "Sparkles" },
];

export function avatarColors(color: string) {
  return { c1: color, c2: AVATAR_PALETTES.find((p) => p.c1 === color)?.c2 ?? colors.periwinkle };
}

export function Avatar({
  color,
  frame = "none",
  aura = "none",
  size = 44,
}: {
  color: string;
  frame?: string;
  aura?: string;
  size?: number;
}) {
  const { c1, c2 } = avatarColors(color);
  const decorated = size >= 100 || frame !== "none" || aura !== "none";
  const id = `avatar-${c1.replace("#", "")}`;
  const spin = useSharedValue(0);
  useEffect(() => {
    if (aura !== "halo") return;
    spin.value = 0;
    spin.value = withRepeat(withTiming(360, { duration: 18_000, easing: Easing.linear }), -1);
  }, [aura, spin]);
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));

  return (
    <View style={{ width: size, height: size }}>
      {aura === "halo" && (
        <Animated.View style={[{ position: "absolute", width: size, height: size }, spinStyle]}>
          <Svg width={size} height={size} viewBox="0 0 124 124">
            <Circle cx="62" cy="62" r="60" fill="none" stroke={c1} strokeWidth={1.5} strokeDasharray="3 7" opacity={0.9} />
          </Svg>
        </Animated.View>
      )}
      <Svg width={size} height={size} viewBox={decorated ? "0 0 124 124" : "14 14 96 96"}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c1} />
            <Stop offset="1" stopColor={c2} />
          </LinearGradient>
        </Defs>
        <Circle cx="62" cy="62" r="48" fill={`url(#${id})`} />
        {frame === "ring" && <Circle cx="62" cy="62" r="53" fill="none" stroke={c2} strokeWidth={3} />}
        {frame === "gem" && (
          <Path d="M62 4 L120 62 L62 120 L4 62 Z" fill="none" stroke={c1} strokeWidth={2.5} strokeLinejoin="round" />
        )}
        <Rect x="46" y="50" width="9" height="15" rx="4.5" fill="#141120" />
        <Rect x="69" y="50" width="9" height="15" rx="4.5" fill="#141120" />
        <Path d="M50 76 Q62 85 74 76" fill="none" stroke="#141120" strokeWidth={4} strokeLinecap="round" />
        {aura === "sparkles" && (
          <Path
            d="M20 28 L23 32 L20 36 L17 32 Z M104 22 L107 26 L104 30 L101 26 Z M108 92 L110.5 95 L108 98 L105.5 95 Z"
            fill="#FFFFFF"
            opacity={0.95}
          />
        )}
      </Svg>
    </View>
  );
}
