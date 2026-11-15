import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { palette } from "@/unpredictable/theme";

export type Mood = "idle" | "thinking" | "smug" | "defeated";

const FRAMES: Record<Mood, string[]> = {
  idle: [
    ".....A.....",
    ".....a.....",
    "..BBBBBBB..",
    ".BBBBBBBBB.",
    ".BWWBBBWWB.",
    ".BWKBBBWKB.",
    ".BBBBBBBBB.",
    ".BBMMMMMBB.",
    ".BBBBBBBBB.",
    "..DDDDDDD..",
    "..SS...SS..",
  ],
  thinking: [
    ".....A.....",
    ".....a.....",
    "..BBBBBBB..",
    ".BBBBBBBBB.",
    ".BWKBBBWKB.",
    ".BWWBBBWWB.",
    ".BBBBBBBBB.",
    ".BBBBMMBBB.",
    ".BBBBBBBBB.",
    "..DDDDDDD..",
    "..SS...SS..",
  ],
  smug: [
    ".....A.....",
    ".....a.....",
    "..BBBBBBB..",
    ".BBBBBBBBB.",
    ".BDDBBBDDB.",
    ".BKWBBBKWB.",
    ".BBBBBBBMB.",
    ".BBMMMMMBB.",
    ".BBBBBBBBB.",
    "..DDDDDDD..",
    "..SS...SS..",
  ],
  defeated: [
    "...........",
    "....aA.....",
    "..BBBBBBB..",
    ".BBBBBBBBB.",
    ".BKWBBBWKB.",
    ".BWKBBBKWB.",
    ".BBBBBBBBB.",
    ".BBBMMMBBB.",
    ".BBMBBBMBB.",
    "..DDDDDDD..",
    "..SS...SS..",
  ],
};

const BODY: Record<Mood, { B: string; D: string; A: string }> = {
  idle: { B: palette.cyan, D: "#2a9fbd", A: palette.gold },
  thinking: { B: palette.cyan, D: "#2a9fbd", A: palette.gold },
  smug: { B: palette.pink, D: "#b83a63", A: palette.gold },
  defeated: { B: palette.dim, D: "#536684", A: palette.border },
};

export function Opponent(props: { mood: Mood; scale?: number }) {
  const scale = props.scale ?? 8;
  const rows = FRAMES[props.mood];
  const body = BODY[props.mood];
  const colors: Record<string, string> = {
    ...body,
    a: palette.dim,
    W: palette.text,
    K: palette.bg,
    M: palette.bg,
    S: body.D,
  };

  const bob = useSharedValue(0);
  const blink = useSharedValue(1);
  useEffect(() => {
    const speed =
      props.mood === "thinking" ? 260 : props.mood === "defeated" ? 900 : 520;
    bob.value = withRepeat(
      withSequence(
        withTiming(-scale, { duration: speed, easing: Easing.steps(2) }),
        withTiming(0, { duration: speed, easing: Easing.steps(2) }),
      ),
      -1,
    );
    blink.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 300, easing: Easing.steps(1) }),
        withTiming(0.2, { duration: 300, easing: Easing.steps(1) }),
      ),
      -1,
    );
  }, [bob, blink, props.mood, scale]);
  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }],
  }));
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  return (
    <Animated.View
      style={bobStyle}
      accessibilityLabel={`AI opponent, ${props.mood}`}
    >
      {rows.map((row, y) => (
        <View key={y} style={{ flexDirection: "row" }}>
          {row.split("").map((cell, x) => {
            const style = {
              width: scale,
              height: scale,
              backgroundColor: cell === "." ? "transparent" : colors[cell],
            };
            return cell === "A" && props.mood !== "defeated" ? (
              <Animated.View key={x} style={[style, blinkStyle]} />
            ) : (
              <View key={x} style={style} />
            );
          })}
        </View>
      ))}
    </Animated.View>
  );
}
