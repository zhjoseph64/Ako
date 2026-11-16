import { useEffect, useState } from "react";
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

const BODY = [
  "...........OO...........",
  "..........OLTO..........",
  ".........OLLTDO.........",
  "........OLLTTTDO........",
  ".......OLLTTTTTDO.......",
  "......OLLTTTDTTTDO......",
  ".....OLLTTTTTTTTTDO.....",
  "....OLLTTTTTTDTTTTDO....",
  "...OLLTTTTTTTTTTTTTDO...",
  "..OLTTTTTTTTTTTTTTTTDO..",
  "..OOOOOOLTTTTTTDOOOOOO..",
  ".......OLTTTTTTDO.......",
  ".......OLTTDTTTDO.......",
  "......OLLTTTTTTTDO......",
  ".....OLLTTTTTTTTTDO.....",
  "....OLLTTTTTTTTTTTDO....",
  "...OLTTTTTTTTTTTTTTDO...",
  "...OTeeeeTTTTTTeeeeDO...",
  "...OTeeeeTTTTTTeeeeDO...",
  "...OTeeeeTTTTTTeeeeDO...",
  "...OTeeeeTTmmTTeeeeDO...",
  "...OTbbTTTTmmTTTTbbDO...",
  "....ODTTTTTTTTTTTTDO....",
  ".....OOOOOOOOOOOOOO.....",
];

const EYES: Record<Mood, string[]> = {
  idle: ["YYYY", "YKKY", "YKWY", "YYYY"],
  thinking: ["YKKY", "YKWY", "YYYY", "YYYY"],
  smug: ["DDDD", "DDDD", "YKKY", "YYYY"],
  defeated: ["KYYK", "YKKY", "YKKY", "KYYK"],
};

const MOUTH: Record<Mood, string[]> = {
  idle: ["TTTT", "KTTK", "TKKT"],
  thinking: ["TTTT", "TKKT", "TKKT"],
  smug: ["TTTT", "TTTK", "KKKT"],
  defeated: ["TTTT", "TKKT", "KTTK"],
};

const TENTACLES = 6;
const SEGMENTS = 8;
const WAVE = [0, 1, 1, 0, 0, -1, -1, 0];

function rowsFor(mood: Mood) {
  const eyes = EYES[mood];
  const mouth = MOUTH[mood];
  return BODY.map((row, y) => {
    let next = row;
    if (y >= 17 && y <= 20) {
      const eye = eyes[y - 17];
      next =
        next.slice(0, 5) +
        eye +
        next.slice(9, 15) +
        eye.split("").reverse().join("") +
        next.slice(19);
    }
    if (y >= 19 && y <= 21) {
      next = next.slice(0, 10) + mouth[y - 19] + next.slice(14);
    }
    return next;
  });
}

export function Opponent(props: { mood: Mood; scale?: number }) {
  const scale = props.scale ?? 5;
  const limp = props.mood === "defeated";
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const speed = props.mood === "thinking" ? 130 : limp ? 700 : 260;
    const timer = setInterval(
      () => setFrame((f) => (f + 1) % WAVE.length),
      speed,
    );
    return () => clearInterval(timer);
  }, [props.mood, limp]);

  const bob = useSharedValue(0);
  useEffect(() => {
    const speed = props.mood === "thinking" ? 220 : limp ? 1100 : 560;
    bob.value = withRepeat(
      withSequence(
        withTiming(-scale, { duration: speed, easing: Easing.steps(1) }),
        withTiming(0, { duration: speed, easing: Easing.steps(1) }),
      ),
      -1,
    );
  }, [bob, props.mood, limp, scale]);
  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }],
  }));

  const body = limp
    ? "#6fa8a8"
    : props.mood === "smug"
      ? "#58e0b0"
      : palette.squid;
  const colors: Record<string, string> = {
    O: palette.squidInk,
    T: body,
    L: limp ? "#a9cfcf" : palette.squidLight,
    D: limp ? "#4a7f84" : palette.squidDark,
    Y: limp ? "#d9d2a0" : palette.gold,
    K: "#160d2b",
    W: "#ffffff",
    b: limp ? body : "#ff9fb0",
    m: body,
    e: body,
  };

  return (
    <Animated.View
      style={[{ alignItems: "center" }, bobStyle]}
      accessibilityLabel={`Squid boss, ${props.mood}`}
    >
      {rowsFor(props.mood).map((row, y) => (
        <View key={y} style={{ flexDirection: "row" }}>
          {row.split("").map((cell, x) => (
            <View
              key={x}
              style={{
                width: scale,
                height: scale,
                backgroundColor: cell === "." ? "transparent" : colors[cell],
              }}
            />
          ))}
        </View>
      ))}
      <View
        style={{
          flexDirection: "row",
          width: 24 * scale,
          justifyContent: "center",
          gap: 0,
        }}
      >
        {Array.from({ length: TENTACLES }, (_, i) => {
          const side = i < TENTACLES / 2 ? -1 : 1;
          const outer = Math.abs(i - (TENTACLES - 1) / 2);
          const length = SEGMENTS - (outer < 1 ? 0 : outer < 2 ? 1 : 2);
          return (
            <View key={i} style={{ width: 3 * scale }}>
              {Array.from({ length }, (_, j) => {
                const sway = limp
                  ? 0
                  : WAVE[(frame + j + i * 2) % WAVE.length] * (j > 1 ? 1 : 0);
                const curl = Math.round(
                  side * outer * Math.max(0, j - 2) * (limp ? 0.2 : 0.6),
                );
                const tip = j === length - 1;
                return (
                  <View
                    key={j}
                    style={{
                      flexDirection: "row",
                      transform: [{ translateX: (sway + curl) * scale }],
                    }}
                  >
                    <View
                      style={{
                        width: scale / 2,
                        height: scale,
                        backgroundColor: palette.squidInk,
                      }}
                    />
                    <View
                      style={{
                        width: scale,
                        height: scale,
                        backgroundColor: j % 3 === 1 ? colors.L : colors.T,
                      }}
                    />
                    <View
                      style={{
                        width: scale,
                        height: scale,
                        backgroundColor: tip ? colors.b : colors.D,
                      }}
                    />
                    <View
                      style={{
                        width: scale / 2,
                        height: scale,
                        backgroundColor: palette.squidInk,
                      }}
                    />
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const HEART = [
  ".OO.OO.",
  "OHPOPPO",
  "OPPPPPO",
  ".OPPPO.",
  "..OPO..",
  "...O...",
];

export function Heart(props: { full: boolean; scale?: number }) {
  const scale = props.scale ?? 3;
  const colors: Record<string, string> = {
    O: palette.ink,
    P: props.full ? palette.pink : palette.panel,
    H: props.full ? "#ffd0da" : palette.panel,
  };
  return (
    <View accessibilityLabel={props.full ? "life" : "lost life"}>
      {HEART.map((row, y) => (
        <View key={y} style={{ flexDirection: "row" }}>
          {row.split("").map((cell, x) => (
            <View
              key={x}
              style={{
                width: scale,
                height: scale,
                backgroundColor: cell === "." ? "transparent" : colors[cell],
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
