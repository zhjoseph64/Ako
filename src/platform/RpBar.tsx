import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

const HEIGHT = 14;
const STRIPE = 12;
const STRIPES_WIDTH = 480;
const SPARKS = [
  { dx: 10, dy: -16, size: 4, color: "#FFFFFF", offset: 0 },
  { dx: 16, dy: -6, size: 3, color: "#B6F2F0", offset: 1 / 3 },
  { dx: 8, dy: 12, size: 3, color: "#F0B3E2", offset: 2 / 3 },
];

function Spark({ clock, spark }: { clock: SharedValue<number>; spark: (typeof SPARKS)[number] }) {
  const style = useAnimatedStyle(() => {
    const phase = (clock.value + spark.offset) % 1;
    return {
      opacity: phase < 0.15 ? phase / 0.15 : 1 - (phase - 0.15) / 0.85,
      transform: [
        { translateX: spark.dx * phase },
        { translateY: spark.dy * phase },
        { scale: 1 - 0.7 * phase },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: -spark.size / 2,
          top: -spark.size / 2,
          width: spark.size,
          height: spark.size,
          borderRadius: 2,
          backgroundColor: spark.color,
        },
        style,
      ]}
    />
  );
}

export function RpBar({ rp, label }: { rp: number; label: string }) {
  const progress = useSharedValue(0);
  const flow = useSharedValue(0);
  const sheen = useSharedValue(0);
  const tip = useSharedValue(0);
  const sparks = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(rp, { duration: 1500, easing: Easing.out(Easing.cubic) });
  }, [rp, progress]);
  useEffect(() => {
    flow.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1);
    sheen.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }), -1);
    tip.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
    sparks.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }), -1);
  }, [flow, sheen, tip, sparks]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));
  const tipAnchorStyle = useAnimatedStyle(() => ({ left: `${progress.value}%`, opacity: progress.value > 0 ? 1 : 0 }));
  const flowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -2 * STRIPE + flow.value * 2 * STRIPE }] }));
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${-100 + Math.min(1, sheen.value / 0.7) * 360}%` }],
  }));
  const tipStyle = useAnimatedStyle(() => ({
    opacity: 0.95 + 0.05 * tip.value,
    transform: [{ scale: 1 + 0.35 * tip.value }],
  }));

  const stripes = [];
  for (let x = -STRIPE; x < STRIPES_WIDTH; x += STRIPE) {
    stripes.push(`M${x} ${HEIGHT} L${x + 6.5} 0 L${x + 12.5} 0 L${x + 6} ${HEIGHT} Z`);
  }

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: rp }}
      testID="profile-rp-bar"
    >
      <Animated.View style={[styles.fill, fillStyle]}>
        <Svg width="100%" height={HEIGHT} preserveAspectRatio="none" viewBox="0 0 100 14" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="rp-fill" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#6E58D8" />
              <Stop offset="0.55" stopColor="#8E9BF0" />
              <Stop offset="1" stopColor="#B6F2F0" />
            </LinearGradient>
          </Defs>
          <Rect width="100" height="14" fill="url(#rp-fill)" />
        </Svg>
        <Animated.View style={[{ position: "absolute", left: 0, top: 0 }, flowStyle]}>
          <Svg width={STRIPES_WIDTH} height={HEIGHT}>
            <Path d={stripes.join(" ")} fill="#FFFFFF" opacity={0.13} />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.sheen, sheenStyle]}>
          <Svg width="100%" height={HEIGHT} preserveAspectRatio="none" viewBox="0 0 100 14">
            <Defs>
              <LinearGradient id="rp-sheen" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.55} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width="100" height="14" fill="url(#rp-sheen)" />
          </Svg>
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.tipAnchor, tipAnchorStyle]} pointerEvents="none">
        <Animated.View style={[styles.tip, tipStyle]}>
          <Svg width={26} height={26}>
            <Defs>
              <RadialGradient id="rp-tip" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#FFFFFF" />
                <Stop offset="0.22" stopColor="#FFFFFF" />
                <Stop offset="0.38" stopColor="#B6F2F0" />
                <Stop offset="0.55" stopColor="#B6F2F0" stopOpacity={0.35} />
                <Stop offset="0.72" stopColor="#B6F2F0" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={13} cy={13} r={13} fill="url(#rp-tip)" />
          </Svg>
        </Animated.View>
        {SPARKS.map((spark) => (
          <Spark key={spark.color} clock={sparks} spark={spark} />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: HEIGHT,
    borderRadius: 7,
    backgroundColor: "#1C1B2E",
    borderWidth: 1,
    borderColor: "#2A2840",
  },
  fill: {
    position: "absolute",
    left: -1,
    top: -1,
    height: HEIGHT,
    borderRadius: 7,
    overflow: "hidden",
    boxShadow: "0 0 16px rgba(142,155,240,0.55)",
  },
  sheen: { position: "absolute", left: 0, top: 0, width: "45%", height: HEIGHT },
  tipAnchor: { position: "absolute", top: HEIGHT / 2 - 1, width: 0, height: 0 },
  tip: { position: "absolute", left: -13, top: -13, width: 26, height: 26 },
});
