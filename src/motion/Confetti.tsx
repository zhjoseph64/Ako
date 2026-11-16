import { useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { haptic } from "./haptics";

const SECONDS = 2.6;
const DRAG = 2.6;
const COLORS = ["#F0A9DC", "#B9A6FF", "#9FD9E6", "#79E2D6", "#FFD36E", "#F5F3FB"];

function noise(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function Piece({ clock, seed, x, y }: { clock: SharedValue<number>; seed: number; x: number; y: number }) {
  const angle = -Math.PI / 2 + (noise(seed) - 0.5) * Math.PI * 0.95;
  const speed = 520 + noise(seed + 1) * 780;
  const fall = 300 + noise(seed + 2) * 240;
  const spin = (noise(seed + 3) - 0.5) * 14;
  const flip = 6 + noise(seed + 4) * 8;
  const sway = 2 + noise(seed + 5) * 3;
  const size = 7 + noise(seed + 6) * 6;
  const round = noise(seed + 7) > 0.7;
  const style = useAnimatedStyle(() => {
    const t = clock.value * SECONDS;
    const glide = (1 - Math.exp(-DRAG * t)) / DRAG;
    return {
      opacity: t <= 0 ? 0 : t < SECONDS - 0.6 ? 1 : (SECONDS - t) / 0.6,
      transform: [
        { translateX: x + Math.cos(angle) * speed * glide + Math.sin(t * sway + seed) * 12 },
        { translateY: y + Math.sin(angle) * speed * glide + fall * (t - glide) },
        { rotate: `${spin * t}rad` },
        { rotateX: `${flip * t}rad` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: -size / 2,
          top: -size / 2,
          width: size,
          height: round ? size : size * 1.5,
          borderRadius: round ? size / 2 : 2,
          backgroundColor: COLORS[Math.floor(noise(seed + 8) * COLORS.length)],
        },
        style,
      ]}
    />
  );
}

export function Confetti({ burst, count = 64, originY = 0.4 }: { burst: number; count?: number; originY?: number }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const clock = useSharedValue(0);
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (!burst) return;
    haptic("success");
    if (reduced) return;
    clock.value = 0;
    clock.value = withTiming(1, { duration: SECONDS * 1000, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(setDone)(burst);
    });
  }, [burst, reduced, clock]);

  if (!burst || done === burst || reduced) return null;
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="confetti"
    >
      {Array.from({ length: count }, (_, index) => (
        <Piece key={`${burst}-${index}`} clock={clock} seed={burst * 97 + index * 9} x={width / 2} y={height * originY} />
      ))}
    </View>
  );
}
