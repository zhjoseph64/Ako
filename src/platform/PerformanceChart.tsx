import { useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import { type GestureResponderEvent, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { api } from "../../convex/_generated/api";
import { rankFor, TIERS } from "../../convex/platform/ranks";
import { RankBadge } from "./RankBadge";
import { colors, fonts, formatPoints } from "./theme";

const RANGES = ["1D", "1W", "1M", "3M", "ALL"] as const;
type Range = (typeof RANGES)[number];
type Mode = "points" | "rating";
type Point = { t: number; rating: number; points: number };

const RANGE_LABEL: Record<Range, string> = {
  "1D": "Today",
  "1W": "Past week",
  "1M": "Past month",
  "3M": "Past 3 months",
  ALL: "All time",
};
const TIER_LINE_COLOR: Record<string, string> = {
  pattern: "#C79BF0",
  signal: "#B08BF2",
  variant: "#8E9BF0",
  outlier: "#79C6CC",
  anomaly: "#B98BF0",
  paradox: "#7F9CF0",
  singular: "#79D6E0",
};
const HEIGHT = 190;
const TOP = 24;
const BOTTOM = 182;
const RIGHT_INSET = 18;

function formatWhen(time: number, range: Range) {
  const date = new Date(time);
  if (range === "1D") return date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
  if (range === "1W") return date.toLocaleString("en-US", { weekday: "short", hour: "numeric" });
  return date.toLocaleString("en-US", { month: "short", day: "numeric" });
}

export function PerformanceChart({ deviceId, now }: { deviceId: string; now: number }) {
  const [mode, setMode] = useState<Mode>("points");
  const [range, setRange] = useState<Range>("1W");
  const [width, setWidth] = useState(390);
  const [hover, setHover] = useState<number | null>(null);
  const fresh = useQuery(api.platform.profile.history, { deviceId, now, range });
  const [shown, setShown] = useState<{ range: Range; rows: Point[] } | null>(null);
  if (fresh && (shown?.rows !== fresh || shown.range !== range)) setShown({ range, rows: fresh });
  const hoverRef = useRef<number | null>(null);

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }), -1);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.7 * (1 - pulse.value),
    transform: [{ scale: 1 + 2.2 * pulse.value }],
  }));

  const chart = useMemo(() => {
    if (!shown || shown.rows.length === 0) return null;
    const rows = [...shown.rows, { ...shown.rows[shown.rows.length - 1], t: Math.max(now, shown.rows[shown.rows.length - 1].t + 60_000) }];
    const values = rows.map((row) => row[mode]);
    const t0 = rows[0].t;
    const span = Math.max(1, rows[rows.length - 1].t - t0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.08 || 1;
    const lo = min - pad;
    const hi = max + pad;
    const xMax = width - RIGHT_INSET;
    const xs = rows.map((row) => +(((row.t - t0) / span) * xMax).toFixed(1));
    const y = (value: number) => +(TOP + ((hi - value) / (hi - lo)) * (BOTTOM - TOP)).toFixed(1);
    const ys = values.map(y);
    const build = (to: number) => xs.slice(0, to + 1).map((x, i) => `${i === 0 ? "M" : "L"}${x} ${ys[i]}`).join("");
    const tierLines =
      mode === "rating"
        ? TIERS.filter((tier) => tier.min > lo && tier.min < hi).map((tier) => ({
            y: y(tier.min),
            label: `${tier.label} · ${formatPoints(tier.min)}`,
            color: TIER_LINE_COLOR[tier.key] ?? colors.periwinkle,
          }))
        : [];
    return { rows, values, xs, ys, build, baseY: y(values[0]), tierLines, range: shown.range };
  }, [shown, mode, width, now]);

  const mouseRef = useRef(false);
  const scrubTo = (x: number) => {
    if (!chart) return;
    let nearest = 0;
    for (let i = 1; i < chart.xs.length; i++) {
      if (Math.abs(chart.xs[i] - x) < Math.abs(chart.xs[nearest] - x)) nearest = i;
    }
    if (nearest === hoverRef.current) return;
    hoverRef.current = nearest;
    setHover(nearest);
    if (Platform.OS !== "web") void Haptics.selectionAsync();
  };
  const scrub = (event: GestureResponderEvent) => scrubTo(event.nativeEvent.locationX);
  const endScrub = () => {
    hoverRef.current = null;
    setHover(null);
  };
  const pick = (next: { mode?: Mode; range?: Range }) => {
    endScrub();
    if (next.mode) setMode(next.mode);
    if (next.range) setRange(next.range);
  };

  const isPoints = mode === "points";
  const last = chart ? chart.values.length - 1 : 0;
  const scrubbing = chart !== null && hover !== null && hover <= last;
  const index = scrubbing ? hover : last;
  const value = chart ? chart.values[index] : 0;
  const start = chart ? chart.values[0] : 0;
  const delta = value - start;
  const up = delta >= 0;
  const lineColor = up ? (isPoints ? colors.up : colors.rating) : colors.down;
  const when = chart ? formatWhen(chart.rows[index].t, chart.range) : "";
  const rank = rankFor(value);
  const hx = chart ? chart.xs[index] : 0;

  return (
    <View testID="profile-performance">
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Performance</Text>
          <View style={styles.modes} accessibilityRole="tablist">
            {(["points", "rating"] as const).map((key) => (
              <Pressable
                key={key}
                onPress={() => pick({ mode: key })}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === key }}
                hitSlop={6}
                style={[styles.mode, mode === key && { backgroundColor: colors.text }]}
                testID={`chart-mode-${key}`}
              >
                <Text style={[styles.modeText, mode === key && { color: colors.ctaText }]}>
                  {key === "points" ? "Points" : "Rating"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Text style={styles.caption}>{isPoints ? "Points earned" : "Rating"}</Text>
        <View style={styles.valueRow}>
          <View style={styles.valueBase}>
            <Text style={styles.value} testID="chart-value">
              {formatPoints(Math.round(value))}
            </Text>
            {isPoints && <Text style={styles.unit}>pts</Text>}
          </View>
          {!isPoints && <RankBadge tier={rank.tier} division={rank.division} size={40} />}
        </View>
        <View style={styles.deltaRow}>
          <Text style={[styles.delta, { color: lineColor }]} testID="chart-delta">
            {up ? "+" : "−"}
            {formatPoints(Math.abs(Math.round(delta)))}
            {isPoints && start > 0 ? ` (${((Math.abs(delta) / start) * 100).toFixed(1)}%)` : ""}
          </Text>
          <Text style={styles.deltaLabel} testID="chart-delta-label">
            {scrubbing ? when : RANGE_LABEL[range]}
          </Text>
        </View>
      </View>

      <View
        style={styles.figure}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessibilityRole="image"
        accessibilityLabel={`${isPoints ? "Points" : "Rating"} history, ${RANGE_LABEL[range].toLowerCase()}`}
      >
        {chart && (
          <>
            <Svg width={width} height={HEIGHT}>
              {isPoints && (
                <Line x1={0} y1={chart.baseY} x2={width} y2={chart.baseY} stroke="#4A4766" strokeWidth={1.2} strokeDasharray="2 5" />
              )}
              {chart.tierLines.map((tier) => (
                <Line key={tier.label} x1={0} y1={tier.y} x2={width} y2={tier.y} stroke={tier.color} strokeWidth={1} strokeDasharray="4 4" opacity={0.55} />
              ))}
              <Path d={chart.build(last)} fill="none" stroke={lineColor} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" opacity={scrubbing ? 0.28 : 1} />
              {scrubbing && (
                <>
                  <Path d={chart.build(index)} fill="none" stroke={lineColor} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
                  <Line x1={hx} y1={18} x2={hx} y2={HEIGHT} stroke={colors.secondary} strokeWidth={1} />
                  <Circle cx={hx} cy={chart.ys[index]} r={5} fill={lineColor} stroke={colors.bg} strokeWidth={2} />
                </>
              )}
              {!scrubbing && <Circle cx={chart.xs[last]} cy={chart.ys[last]} r={4.5} fill={lineColor} stroke={colors.bg} strokeWidth={2} />}
            </Svg>
            {!scrubbing && (
              <Animated.View
                pointerEvents="none"
                style={[styles.liveDot, { left: chart.xs[last] - 4.5, top: chart.ys[last] - 4.5, backgroundColor: lineColor }, pulseStyle]}
              />
            )}
            {chart.tierLines.map((tier) => (
              <View key={tier.label} pointerEvents="none" style={[styles.tierLabel, { top: tier.y - 20 }]}>
                <Text style={[styles.tierLabelText, { color: tier.color }]}>{tier.label}</Text>
              </View>
            ))}
            {scrubbing && (
              <Text
                pointerEvents="none"
                style={[styles.hoverLabel, { left: Math.max(40, Math.min(width - 40, hx)) - 60 }]}
                testID="chart-scrub-label"
              >
                {when}
              </Text>
            )}
          </>
        )}
        <View
          style={styles.touch}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={scrub}
          onResponderMove={scrub}
          onResponderRelease={() => {
            if (!mouseRef.current) endScrub();
          }}
          onPointerMove={(event) => {
            mouseRef.current = event.nativeEvent.pointerType === "mouse";
            if (mouseRef.current) scrubTo(event.nativeEvent.offsetX);
          }}
          onPointerLeave={endScrub}
          onResponderTerminate={endScrub}
          testID="chart-scrub"
        />
      </View>

      <View style={styles.ranges}>
        {RANGES.map((key) => {
          const on = key === range;
          return (
            <Pressable
              key={key}
              onPress={() => pick({ range: key })}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              hitSlop={{ top: 4, bottom: 4 }}
              style={[styles.range, on && { backgroundColor: isPoints ? "#173A38" : "#2A2450" }]}
              testID={`chart-range-${key}`}
            >
              <Text style={[styles.rangeText, on && { color: isPoints ? colors.up : "#C9B8FF" }]}>{key}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 20, gap: 4 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontFamily: fonts.headingMedium, fontSize: 19, color: colors.text },
  modes: { flexDirection: "row", gap: 4, padding: 3, borderRadius: 999, backgroundColor: colors.surface },
  mode: { height: 32, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center" },
  modeText: { fontFamily: fonts.bold, fontSize: 13, color: colors.tertiary },
  caption: { fontFamily: fonts.medium, fontSize: 14, color: colors.tertiary },
  valueRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 46 },
  valueBase: { flexDirection: "row", alignItems: "baseline", gap: 7 },
  value: {
    fontFamily: fonts.headingMedium,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1.2,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  unit: { fontFamily: fonts.medium, fontSize: 16, color: colors.tertiary },
  deltaRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 22 },
  delta: { fontFamily: fonts.semibold, fontSize: 14.5, fontVariant: ["tabular-nums"] },
  deltaLabel: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.tertiary },
  figure: { marginTop: 6, height: HEIGHT },
  liveDot: { position: "absolute", width: 9, height: 9, borderRadius: 4.5 },
  tierLabel: {
    position: "absolute",
    right: 8,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 999,
    backgroundColor: colors.bg,
  },
  tierLabelText: { fontFamily: fonts.bold, fontSize: 11 },
  hoverLabel: {
    position: "absolute",
    top: 0,
    width: 120,
    textAlign: "center",
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: colors.secondary,
  },
  touch: { ...StyleSheet.absoluteFill, cursor: "crosshair", touchAction: "none" } as object,
  ranges: { flexDirection: "row", gap: 6, paddingTop: 6, paddingHorizontal: 20 },
  range: { minWidth: 52, height: 36, paddingHorizontal: 12, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  rangeText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.tertiary },
});
