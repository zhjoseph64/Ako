import * as Haptics from "expo-haptics";
import { ReactNode, useEffect, useState } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { fonts, palette, unit, WATER_BANDS } from "@/unpredictable/theme";

export function tap() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function thud() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

export function buzz(kind: "win" | "lose" | "void") {
  const type =
    kind === "win"
      ? Haptics.NotificationFeedbackType.Success
      : kind === "lose"
        ? Haptics.NotificationFeedbackType.Error
        : Haptics.NotificationFeedbackType.Warning;
  void Haptics.notificationAsync(type).catch(() => {});
}

type TextProps = {
  children: ReactNode;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
  numberOfLines?: number;
};

export function Display(props: TextProps) {
  const size = props.size ?? 16;
  return (
    <Text
      testID={props.testID}
      numberOfLines={props.numberOfLines}
      style={[
        {
          fontFamily: fonts.pixel,
          fontSize: size,
          lineHeight: Math.round(size * 1.5),
          color: props.color ?? palette.text,
        },
        props.style,
      ]}
    >
      {props.children}
    </Text>
  );
}

export function Body(props: TextProps) {
  const size = props.size ?? 10;
  return (
    <Text
      testID={props.testID}
      numberOfLines={props.numberOfLines}
      style={[
        {
          fontFamily: fonts.pixel,
          fontSize: size,
          lineHeight: Math.round(size * 1.8),
          color: props.color ?? palette.text,
        },
        props.style,
      ]}
    >
      {props.children}
    </Text>
  );
}

export function PixelBox(props: {
  children: ReactNode;
  color?: string;
  fill?: string;
  style?: StyleProp<ViewStyle>;
  pad?: number;
}) {
  return (
    <View style={styles.boxOuter}>
      <View
        style={[
          styles.box,
          {
            borderColor: props.color ?? palette.border,
            backgroundColor: props.fill ?? palette.panel,
            padding: props.pad ?? unit * 3,
          },
          props.style,
        ]}
      >
        {props.children}
      </View>
    </View>
  );
}

const TONES = {
  cyan: { face: palette.cyan, shade: palette.cyanDark },
  gold: { face: palette.gold, shade: palette.goldDark },
  pink: { face: palette.pink, shade: palette.pinkDark },
};

export function PixelButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: keyof typeof TONES;
  testID?: string;
}) {
  const tone = TONES[props.tone ?? "cyan"];
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      disabled={props.disabled}
      onPressIn={tap}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: tone.face,
          borderBottomColor: tone.shade,
          borderRightColor: tone.shade,
          opacity: props.disabled ? 0.45 : 1,
          transform: [{ translateY: pressed ? 3 : 0 }],
        },
      ]}
    >
      <Display size={12} color={palette.ink} style={styles.buttonText}>
        {props.label}
      </Display>
    </Pressable>
  );
}

export function BackLink(props: { onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      hitSlop={12}
      testID="back-button"
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Body color={palette.dim}>{"◀ BACK"}</Body>
    </Pressable>
  );
}

export function useFrame(ms: number, frames: number) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f + 1) % frames), ms);
    return () => clearInterval(timer);
  }, [ms, frames]);
  return frame;
}

function Bubble(props: {
  left: number;
  size: number;
  delay: number;
  duration: number;
}) {
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withDelay(
      props.delay,
      withRepeat(
        withTiming(1, { duration: props.duration, easing: Easing.linear }),
        -1,
      ),
    );
  }, [rise, props.delay, props.duration]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -rise.value * 980 },
      { translateX: Math.round(Math.sin(rise.value * 14) * 2) * unit },
    ],
    opacity: rise.value > 0.9 ? 0 : 0.55,
  }));
  return (
    <Animated.View
      style={[
        styles.bubble,
        { left: `${props.left}%`, width: props.size, height: props.size },
        style,
      ]}
    >
      <View style={styles.bubbleShine} />
    </Animated.View>
  );
}

const BUBBLES = Array.from({ length: 9 }, (_, i) => ({
  left: (i * 37 + 11) % 96,
  size: (2 + (i % 3)) * unit,
  delay: i * 1100,
  duration: 9000 + (i % 4) * 2600,
}));

function Ray(props: { left: number; width: number; delay: number }) {
  const drift = useSharedValue(0);
  useEffect(() => {
    drift.value = withDelay(
      props.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 7000, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      ),
    );
  }, [drift, props.delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.04 + drift.value * 0.05,
    transform: [{ translateX: drift.value * 24 }, { rotate: "16deg" }],
  }));
  return (
    <Animated.View
      style={[
        styles.ray,
        { left: `${props.left}%`, width: props.width },
        style,
      ]}
    />
  );
}

const WEEDS = [
  { left: 3, height: 9 },
  { left: 12, height: 6 },
  { left: 22, height: 11 },
  { left: 71, height: 7 },
  { left: 82, height: 12 },
  { left: 92, height: 8 },
];
const SWAY = [0, 1, 1, 0, -1, -1];

function Seaweed() {
  const frame = useFrame(420, SWAY.length);
  return (
    <>
      {WEEDS.map((weed, i) => (
        <View key={i} style={[styles.weed, { left: `${weed.left}%` }]}>
          {Array.from({ length: weed.height }, (_, j) => {
            const level = weed.height - j;
            const sway =
              level < 3 ? 0 : SWAY[(frame + level + i) % SWAY.length];
            return (
              <View
                key={j}
                style={{
                  width: unit * 2,
                  height: unit * 2,
                  backgroundColor:
                    (j + i) % 2 === 0 ? palette.weed : palette.weedDark,
                  transform: [{ translateX: sway * unit }],
                }}
              />
            );
          })}
        </View>
      ))}
    </>
  );
}

const FISH = ["..OO..O", ".OFFOOF", "OFKFFFO", ".OFFOOF", "..OO..O"];

function Fish(props: {
  top: number;
  duration: number;
  delay: number;
  color: string;
}) {
  const swim = useSharedValue(0);
  useEffect(() => {
    swim.value = withDelay(
      props.delay,
      withRepeat(
        withTiming(1, { duration: props.duration, easing: Easing.linear }),
        -1,
      ),
    );
  }, [swim, props.delay, props.duration]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: 480 - swim.value * 560 },
      { translateY: Math.round(Math.sin(swim.value * 20) * 2) * unit },
    ],
  }));
  const colors: Record<string, string> = {
    O: palette.ink,
    F: props.color,
    K: palette.ink,
  };
  return (
    <Animated.View
      style={[
        { position: "absolute", top: `${props.top}%`, left: 0, opacity: 0.5 },
        style,
      ]}
    >
      {FISH.map((row, y) => (
        <View key={y} style={{ flexDirection: "row" }}>
          {row.split("").map((cell, x) => (
            <View
              key={x}
              style={{
                width: 3,
                height: 3,
                backgroundColor: cell === "." ? "transparent" : colors[cell],
              }}
            />
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

export function Ocean() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {WATER_BANDS.map((color) => (
        <View key={color} style={{ flex: 1, backgroundColor: color }} />
      ))}
      <Ray left={8} width={46} delay={0} />
      <Ray left={38} width={70} delay={2500} />
      <Ray left={70} width={34} delay={5000} />
      <Fish top={22} duration={26000} delay={3000} color={palette.gold} />
      <Fish top={58} duration={34000} delay={15000} color={palette.pink} />
      <View style={styles.sand} />
      <Seaweed />
      {BUBBLES.map((b, i) => (
        <Bubble key={i} {...b} />
      ))}
    </View>
  );
}

export function Screen(props: {
  children: ReactNode;
  shake?: ReturnType<typeof useShake>["style"];
  flash?: ReactNode;
}) {
  return (
    <View style={styles.screen}>
      <Ocean />
      <SafeAreaView style={styles.safe}>
        <Animated.View style={[styles.safe, props.shake]}>
          {props.children}
        </Animated.View>
      </SafeAreaView>
      {props.flash}
    </View>
  );
}

export function useShake() {
  const x = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));
  const shake = (strength: number) => {
    const step = (to: number) =>
      withTiming(to, { duration: 45, easing: Easing.steps(1) });
    x.set(
      withSequence(
        step(strength),
        step(-strength),
        step(strength * 0.7),
        step(-strength * 0.7),
        step(strength * 0.4),
        step(-strength * 0.4),
        step(0),
      ),
    );
  };
  return { style, shake };
}

export function Flash(props: { color: string; trigger: number }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (props.trigger === 0) return;
    opacity.value = withSequence(
      withTiming(0.55, { duration: 60 }),
      withTiming(0, { duration: 90 }),
      withTiming(0.35, { duration: 60 }),
      withTiming(0, { duration: 260 }),
    );
  }, [props.trigger, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: props.color }, style]}
    />
  );
}

const CONFETTI_COLORS = [
  palette.cyan,
  palette.green,
  palette.gold,
  palette.pink,
  palette.text,
];

function ConfettiPiece(props: {
  left: number;
  color: string;
  delay: number;
  size: number;
  drift: number;
}) {
  const fall = useSharedValue(0);
  useEffect(() => {
    fall.value = withDelay(
      props.delay,
      withTiming(1, { duration: 1700, easing: Easing.in(Easing.quad) }),
    );
  }, [fall, props.delay]);
  const style = useAnimatedStyle(() => ({
    opacity: fall.value === 0 ? 0 : 1 - Math.max(0, fall.value - 0.8) * 5,
    transform: [
      { translateY: -40 + fall.value * 980 },
      { translateX: Math.round(Math.sin(fall.value * 9) * props.drift) },
    ],
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 0,
          left: `${props.left}%`,
          width: props.size,
          height: props.size,
          backgroundColor: props.color,
        },
        style,
      ]}
    />
  );
}

export function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 36 }, (_, i) => ({
      left: Math.random() * 96,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 500,
      size: (1 + (i % 3)) * unit,
      drift: 8 + Math.random() * 24,
    })),
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((piece, i) => (
        <ConfettiPiece key={i} {...piece} />
      ))}
    </View>
  );
}

export function useCountUp(target: number, active: boolean, stepMs = 30) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setValue((current) => {
        if (current >= target) {
          clearInterval(timer);
          return target;
        }
        return Math.min(target, current + Math.max(1, Math.ceil(target / 25)));
      });
    }, stepMs);
    return () => clearInterval(timer);
  }, [target, active, stepMs]);
  return active ? Math.min(value, target) : 0;
}

export function Blink(props: { children: ReactNode; ms?: number }) {
  const on = useSharedValue(1);
  useEffect(() => {
    on.value = withRepeat(
      withSequence(
        withTiming(1, { duration: props.ms ?? 450, easing: Easing.steps(1) }),
        withTiming(0.15, {
          duration: props.ms ?? 450,
          easing: Easing.steps(1),
        }),
      ),
      -1,
    );
  }, [on, props.ms]);
  const style = useAnimatedStyle(() => ({ opacity: on.value }));
  return <Animated.View style={style}>{props.children}</Animated.View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  safe: { flex: 1 },
  bubble: {
    position: "absolute",
    bottom: -20,
    borderWidth: 2,
    borderColor: "#bdefff",
  },
  bubbleShine: { width: 2, height: 2, backgroundColor: "#ffffff", margin: 1 },
  ray: {
    position: "absolute",
    top: -60,
    height: "75%",
    backgroundColor: "#c9f6ff",
  },
  sand: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: unit * 5,
    backgroundColor: palette.sand,
    borderTopWidth: unit,
    borderTopColor: "#3f5257",
  },
  weed: { position: "absolute", bottom: unit * 4, opacity: 0.8 },
  boxOuter: {
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.ink,
  },
  box: { borderWidth: 3 },
  button: {
    paddingHorizontal: unit * 3,
    paddingVertical: unit * 3.5,
    borderWidth: 3,
    borderColor: palette.ink,
    borderBottomWidth: 6,
    borderRightWidth: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { textAlign: "center" },
});
