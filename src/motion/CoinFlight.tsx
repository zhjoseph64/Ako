import { useEffect, useState } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const SPAN = 0.55;
const COINS = [
  { x: 150, y: 210 },
  { x: 40, y: 250 },
  { x: 230, y: 180 },
  { x: -20, y: 190 },
  { x: 110, y: 280 },
  { x: 270, y: 250 },
  { x: 70, y: 170 },
  { x: 190, y: 300 },
  { x: 10, y: 300 },
];

function Coin({ clock, index, drain }: { clock: SharedValue<number>; index: number; drain: boolean }) {
  const coin = COINS[index];
  const delay = (index / COINS.length) * (1 - SPAN);
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (clock.value - delay) / SPAN));
    if (drain) {
      return {
        opacity: t <= 0 ? 0 : 1 - t * t,
        transform: [
          { translateX: coin.x * 0.7 * t },
          { translateY: 36 + coin.y * t * t - Math.sin(Math.PI * Math.min(1, t * 2)) * 22 },
          { scale: 1 - 0.3 * t },
        ],
      };
    }
    const eased = t * t;
    return {
      opacity: t <= 0 ? 0 : t < 0.85 ? 1 : (1 - t) / 0.15,
      transform: [
        { translateX: coin.x * (1 - eased) },
        { translateY: coin.y * (1 - eased) - Math.sin(Math.PI * t) * 34 },
        { scale: 1 - 0.45 * eased },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: "#FFD36E",
          borderWidth: 2,
          borderColor: "#F2A93B",
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFF1C2" }} />
    </Animated.View>
  );
}

export function CoinFlight({ burst, drain = false, style }: { burst: number; drain?: boolean; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const clock = useSharedValue(0);
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (!burst || reduced) return;
    clock.value = 0;
    clock.value = withTiming(1, { duration: 950, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(setDone)(burst);
    });
  }, [burst, reduced, clock]);

  if (!burst || done === burst || reduced) return null;
  return (
    <View
      pointerEvents="none"
      style={[{ position: "absolute", zIndex: 5 }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="coin-flight"
    >
      {COINS.map((_, index) => (
        <Coin key={`${burst}-${index}`} clock={clock} index={index} drain={drain} />
      ))}
    </View>
  );
}
