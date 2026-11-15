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

import { fonts, palette, unit } from "@/unpredictable/theme";

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

export function Display(props: {
  children: ReactNode;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  const size = props.size ?? 16;
  return (
    <Text
      testID={props.testID}
      style={[
        {
          fontFamily: fonts.display,
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

export function Body(props: {
  children: ReactNode;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
  numberOfLines?: number;
}) {
  const size = props.size ?? 22;
  return (
    <Text
      testID={props.testID}
      numberOfLines={props.numberOfLines}
      style={[
        {
          fontFamily: fonts.body,
          fontSize: size,
          lineHeight: Math.round(size * 1.05),
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
  shadow?: string;
  style?: StyleProp<ViewStyle>;
  pad?: number;
}) {
  return (
    <View style={styles.boxWrap}>
      <View
        style={[
          styles.boxShadow,
          { backgroundColor: props.shadow ?? palette.shadow },
        ]}
      />
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

export function PixelButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
  shadow?: string;
  testID?: string;
}) {
  const color = props.color ?? palette.cyan;
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      disabled={props.disabled}
      onPressIn={tap}
      onPress={props.onPress}
      style={[styles.buttonWrap, props.disabled && styles.off]}
    >
      {({ pressed }) => (
        <>
          <View
            style={[
              styles.buttonShadow,
              { backgroundColor: props.shadow ?? palette.cyanDark },
            ]}
          />
          <View
            style={[
              styles.button,
              {
                backgroundColor: color,
                transform: [{ translateY: pressed ? unit * 1.5 : 0 }],
              },
            ]}
          >
            <View style={styles.buttonShine} />
            <Display size={13} color={palette.bg}>
              {props.label}
            </Display>
          </View>
        </>
      )}
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
      <Body color={palette.dim} size={22}>
        {"◀ BACK"}
      </Body>
    </Pressable>
  );
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
    transform: [{ translateY: -rise.value * 900 }],
    opacity: 0.5 - rise.value * 0.5,
  }));
  return (
    <Animated.View
      style={[
        styles.bubble,
        { left: `${props.left}%`, width: props.size, height: props.size },
        style,
      ]}
    />
  );
}

const BUBBLES = Array.from({ length: 10 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  size: i % 3 === 0 ? unit * 2 : unit,
  delay: i * 900,
  duration: 9000 + (i % 4) * 2500,
}));

export function Screen(props: {
  children: ReactNode;
  shake?: ReturnType<typeof useShake>["style"];
  flash?: ReactNode;
}) {
  return (
    <View style={styles.screen}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {BUBBLES.map((b, i) => (
          <Bubble key={i} {...b} />
        ))}
      </View>
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
    backgroundColor: palette.border,
  },
  boxWrap: { marginBottom: unit },
  boxShadow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: unit,
    bottom: -unit,
  },
  box: { borderWidth: 3 },
  buttonWrap: { marginBottom: unit * 1.5 },
  buttonShadow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: unit * 1.5,
    bottom: -unit * 1.5,
  },
  button: {
    paddingVertical: unit * 4,
    alignItems: "center",
    borderWidth: 3,
    borderColor: palette.bg,
  },
  buttonShine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: unit,
    backgroundColor: "#ffffff55",
  },
  off: { opacity: 0.35 },
});
