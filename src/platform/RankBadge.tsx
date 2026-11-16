import { useEffect } from "react";
import { Image, type ImageSourcePropType, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import type { TierKey } from "../../convex/platform/ranks";

const BADGES: Record<TierKey, [ImageSourcePropType, ImageSourcePropType, ImageSourcePropType]> = {
  echo: [require("@/assets/badges/echo-1.png"), require("@/assets/badges/echo-2.png"), require("@/assets/badges/echo-3.png")],
  pattern: [require("@/assets/badges/pattern-1.png"), require("@/assets/badges/pattern-2.png"), require("@/assets/badges/pattern-3.png")],
  signal: [require("@/assets/badges/signal-1.png"), require("@/assets/badges/signal-2.png"), require("@/assets/badges/signal-3.png")],
  variant: [require("@/assets/badges/variant-1.png"), require("@/assets/badges/variant-2.png"), require("@/assets/badges/variant-3.png")],
  outlier: [require("@/assets/badges/outlier-1.png"), require("@/assets/badges/outlier-2.png"), require("@/assets/badges/outlier-3.png")],
  anomaly: [require("@/assets/badges/anomaly-1.png"), require("@/assets/badges/anomaly-2.png"), require("@/assets/badges/anomaly-3.png")],
  paradox: [require("@/assets/badges/paradox-1.png"), require("@/assets/badges/paradox-2.png"), require("@/assets/badges/paradox-3.png")],
  singular: [require("@/assets/badges/singular-1.png"), require("@/assets/badges/singular-2.png"), require("@/assets/badges/singular-3.png")],
};

const GLOW: Record<TierKey, string> = {
  echo: "#8FB8D6",
  pattern: "#C79BF0",
  signal: "#B08BF2",
  variant: "#6CB8C9",
  outlier: "#C08AF0",
  anomaly: "#B98BF0",
  paradox: "#7F9CF0",
  singular: "#79D6E0",
};

export function RankBadge({
  tier,
  division,
  size = 160,
  glow = true,
}: {
  tier: TierKey;
  division: number;
  size?: number;
  glow?: boolean;
}) {
  const pulse = useSharedValue(0.3);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.75, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const gradientId = `badge-glow-${tier}`;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${tier} ${division} rank badge`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <Animated.View style={[{ position: "absolute", width: size, height: size }, glowStyle]}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={GLOW[tier]} stopOpacity={1} />
                <Stop offset="0.55" stopColor={GLOW[tier]} stopOpacity={0.5} />
                <Stop offset="1" stopColor={GLOW[tier]} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={size / 2} cy={size / 2} r={size * 0.42} fill={`url(#${gradientId})`} />
          </Svg>
        </Animated.View>
      )}
      <Image source={BADGES[tier][Math.min(3, Math.max(1, division)) - 1]} style={{ width: size, height: size }} />
    </View>
  );
}
