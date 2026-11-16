import { useLayoutEffect, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { haptic } from "./haptics";
import { duration, easing } from "./tokens";

const STRIP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

function Digit({
  value,
  place,
  keep,
  lineHeight,
  width,
  style,
}: {
  value: SharedValue<number>;
  place: number;
  keep: boolean;
  lineHeight: number;
  width: SharedValue<number>;
  style: StyleProp<TextStyle>;
}) {
  const unit = Math.pow(10, place);
  const roll = useAnimatedStyle(() => {
    const now = Math.max(0, value.value);
    const position = place === 0 ? now % 10 : (Math.floor(now / unit) % 10) + Math.max(0, (now % unit) - (unit - 1));
    return { opacity: keep || now >= unit ? 1 : 0, transform: [{ translateY: -position * lineHeight }] };
  });
  return (
    <View
      style={{ height: lineHeight, overflow: "hidden" }}
      onLayout={place === 0 ? (event) => width.set(event.nativeEvent.layout.width) : undefined}
    >
      <Text style={[style, { lineHeight, opacity: 0 }]}>0</Text>
      <Animated.View style={[StyleSheet.absoluteFill, roll]}>
        {STRIP.map((digit, index) => (
          <Text key={index} style={[style, { lineHeight, height: lineHeight }]}>
            {digit}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

export function RollingNumber({
  value,
  format,
  active = true,
  epoch = 0,
  lineHeight,
  style,
  placeholder = "–",
  testID,
  onRoll,
}: {
  value: number | undefined;
  format: (value: number) => string;
  active?: boolean;
  epoch?: number;
  lineHeight: number;
  style?: StyleProp<TextStyle>;
  placeholder?: string;
  testID?: string;
  onRoll?: (from: number, to: number, changed: boolean) => void;
}) {
  const reduced = useReducedMotion();
  const shared = useSharedValue(0);
  const digitWidth = useSharedValue(0);
  const [shown, setShown] = useState<{ value: number | null; epoch: number }>({ value: null, epoch: -1 });
  const [rolling, setRolling] = useState<{ from: number; to: number; changed: boolean } | null>(null);

  if (value !== undefined && active && (shown.value !== value || shown.epoch !== epoch)) {
    const from = shown.epoch !== epoch ? (shown.value !== null && shown.value !== value ? shown.value : 0) : (shown.value ?? 0);
    setShown({ value, epoch });
    if (from !== value && !reduced) setRolling({ from, to: value, changed: shown.value !== null && shown.value !== value });
  }

  useLayoutEffect(() => {
    if (!rolling) return;
    const finish = () => {
      setRolling((current) => (current === rolling ? null : current));
      haptic("tick");
    };
    onRoll?.(rolling.from, rolling.to, rolling.changed);
    shared.set(rolling.from);
    shared.set(
      withTiming(rolling.to, { duration: duration.count, easing: easing.out }, (finished) => {
        if (finished) runOnJS(finish)();
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolling]);

  const template = rolling ? format(Math.max(rolling.from, rolling.to)) : "";
  const digits = template.replace(/\D/g, "").length;
  const fixed = template.includes(".") ? template.length - template.indexOf(".") : 1;
  const shift = useAnimatedStyle(() => {
    let hidden = 0;
    for (let place = digits - 1; place >= fixed; place--) {
      if (Math.max(0, shared.get()) >= Math.pow(10, place)) break;
      hidden++;
    }
    return { opacity: digitWidth.get() > 0 ? 1 : 0, transform: [{ translateX: -hidden * digitWidth.get() }] };
  });

  if (!rolling) {
    return (
      <Text style={[style, { lineHeight }]} testID={testID}>
        {value === undefined ? placeholder : format(shown.value ?? value)}
      </Text>
    );
  }

  const lead = template.search(/\d/);
  let place = digits;
  return (
    <View style={styles.row} accessible accessibilityRole="text" accessibilityLabel={format(rolling.to)} testID={testID}>
      <Text style={[style, { lineHeight }]}>{template.slice(0, lead)}</Text>
      <Animated.View style={[styles.row, shift]}>
        {template
          .slice(lead)
          .split("")
          .map((char, index) => {
            if (!/\d/.test(char)) {
              return (
                <Text key={index} style={[style, { lineHeight }]}>
                  {char}
                </Text>
              );
            }
            place--;
            return <Digit key={index} value={shared} place={place} keep={place < fixed} lineHeight={lineHeight} width={digitWidth} style={style} />;
          })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row" } });
