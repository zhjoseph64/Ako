import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

import { AVATAR_AURAS, AVATAR_FRAMES, AVATAR_PALETTES, Avatar, avatarColors } from "@/platform/Avatar";
import { PerformanceChart } from "@/platform/PerformanceChart";
import { RankBadge } from "@/platform/RankBadge";
import { RpBar } from "@/platform/RpBar";
import { Sheet } from "@/platform/Sheet";
import { colors, fonts, formatPoints } from "@/platform/theme";
import { Toast } from "@/platform/Toast";
import { TopBar } from "@/platform/ui";
import { useMe } from "@/platform/useMe";
import { dayLabel, GAME_TITLES, startOfDay, startOfMonth } from "@/platform/when";
import { api } from "../../../convex/_generated/api";
import { TIERS } from "../../../convex/platform/ranks";

const RP_PER_RATING = 100 / (500 / 3);
const EDITOR_TABS = ["Color", "Frame", "Aura"] as const;

function useCountUp(target: number | undefined) {
  const [shown, setShown] = useState<{ value: number; target: number } | null>(null);
  useEffect(() => {
    if (target === undefined) return;
    const from = shown?.target ?? Math.max(0, target - 142);
    if (from === target) return setShown({ value: target, target });
    const startedAt = Date.now();
    let frame = requestAnimationFrame(function step() {
      const progress = Math.min(1, (Date.now() - startedAt) / 1500);
      setShown({ value: Math.round(from + (target - from) * (1 - Math.pow(1 - progress, 3))), target });
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return shown?.value ?? Math.max(0, (target ?? 0) - 142);
}

function Swatch({ tab, index, c1, c2 }: { tab: (typeof EDITOR_TABS)[number]; index: number; c1: string; c2: string }) {
  if (tab === "Color") {
    return (
      <Svg width={34} height={34}>
        <Defs>
          <LinearGradient id={`swatch-${index}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c1} />
            <Stop offset="1" stopColor={c2} />
          </LinearGradient>
        </Defs>
        <Rect width={34} height={34} rx={17} fill={`url(#swatch-${index})`} />
      </Svg>
    );
  }
  if (index === 0) return <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderStyle: "dashed", borderColor: "#4A4766" }} />;
  if (tab === "Frame") {
    return index === 1 ? (
      <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 3, borderColor: c2 }} />
    ) : (
      <View style={{ width: 22, height: 22, borderRadius: 3, borderWidth: 3, borderColor: c1, transform: [{ rotate: "45deg" }] }} />
    );
  }
  return index === 1 ? (
    <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderStyle: "dotted", borderColor: c1 }} />
  ) : (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Path d="M15 8 L22 15 L15 22 L8 15 Z M26 5 L29 8 L26 11 L23 8 Z M5 21 L7 23 L5 25 L3 23 Z" fill="#FFFFFF" />
    </Svg>
  );
}

export default function Profile() {
  const { me, deviceId, secret, now } = useMe();
  const stats = useQuery(api.platform.profile.stats, deviceId ? { deviceId } : "skip");
  const activity = useQuery(
    api.platform.profile.activity,
    deviceId ? { deviceId, dayStart: startOfDay(now), monthStart: startOfMonth(now) } : "skip",
  );
  const updateAvatar = useMutation(api.platform.profile.updateAvatar);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<(typeof EDITOR_TABS)[number]>("Color");
  const [draft, setDraft] = useState<{ color: string; frame: string; aura: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const rating = useCountUp(me?.rating);

  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(withTiming(-7, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [float]);
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: float.value }] }));

  if (!me || !deviceId) return <SafeAreaView edges={["top"]} style={styles.screen} testID="profile" />;

  const avatar = draft ?? me.avatar;
  const palette = avatarColors(avatar.color);
  const change = (next: Partial<typeof avatar>) => {
    const value = { ...avatar, ...next };
    setDraft(value);
    if (!secret) return;
    updateAvatar({ deviceId, secret, avatar: value }).catch(() => {
      setDraft(null);
      setToast("Couldn't save your avatar");
    });
  };
  const options =
    tab === "Color"
      ? AVATAR_PALETTES.map((p) => ({ label: p.label, on: avatar.color === p.c1, pick: () => change({ color: p.c1 }) }))
      : tab === "Frame"
        ? AVATAR_FRAMES.map((f) => ({ label: f.label, on: avatar.frame === f.key, pick: () => change({ frame: f.key }) }))
        : AVATAR_AURAS.map((a) => ({ label: a.label, on: avatar.aura === a.key, pick: () => change({ aura: a.key }) }));

  const toGo = 100 - me.rp;
  const nextStep = me.division < 3 ? `${me.tierLabel} ${me.division + 1}` : me.nextTierLabel ? `${me.nextTierLabel} 1` : null;
  const nextTier = TIERS.find((tier) => tier.key === me.nextTier);
  const matches = (activity?.entries ?? []).filter((entry) => entry.game === "unpredictable" || entry.game === "jailbreak").slice(0, 5);

  return (
    <SafeAreaView edges={["top"]} style={styles.screen} testID="profile">
      <ScrollView contentContainerStyle={styles.content}>
        <TopBar
          title="Profile"
          right={
            <Pressable
              onPress={() => setEditing(true)}
              accessibilityRole="button"
              accessibilityLabel="Edit avatar"
              style={styles.pen}
              testID="profile-edit-avatar"
            >
              <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
                <Path d="M13.5 6.5l4 4" />
              </Svg>
            </Pressable>
          }
        />

        <View style={styles.identity}>
          <Avatar color={avatar.color} frame={avatar.frame} aura={avatar.aura} size={124} />
          <View style={{ alignItems: "center", gap: 2 }}>
            <Text style={styles.name} testID="profile-name">@{me.name}</Text>
            <Text style={styles.joined}>
              Joined {new Date(me.joinedAt).toLocaleString("en-US", { month: "short", year: "numeric" })}
              {me.streakDays > 0 ? ` · ${me.streakDays}-day streak` : ""}
            </Text>
          </View>
        </View>

        <View style={styles.rankCard} testID="profile-rank-card">
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <RadialGradient id="rank-glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#7F8EF0" stopOpacity={0.22} />
                <Stop offset="0.7" stopColor="#0B0B14" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx="50%" cy="22%" rx="60%" ry="45%" fill="url(#rank-glow)" />
          </Svg>
          <Animated.View style={floatStyle}>
            <RankBadge tier={me.tier} division={me.division} size={150} />
          </Animated.View>
          <Text style={styles.rankName} testID="profile-rank">
            {me.tierLabel} {me.division}
          </Text>
          <Text style={styles.ratingLabel}>
            Rating <Text style={styles.ratingValue} testID="profile-rating">{formatPoints(rating)}</Text>
          </Text>

          <View style={styles.rpBlock}>
            <View style={styles.rpRow}>
              <Text style={styles.rpText} testID="profile-rp">{me.rp} / 100 RP</Text>
              <Text style={[styles.rpText, { color: colors.accent }]}>{nextStep ? `${toGo} RP to ${nextStep}` : "Top tier"}</Text>
            </View>
            <RpBar rp={me.rp} label={nextStep ? `Progress to ${nextStep}` : "Rank progress"} />
          </View>

          <View style={styles.steps}>
            {[1, 2, 3].map((n) => {
              const here = n === me.division;
              return (
                <View key={n} style={[styles.step, !here && { opacity: n < me.division ? 0.78 : 0.72 }]} testID={`profile-division-${n}`}>
                  <View style={here ? styles.stepHere : styles.stepIdle}>
                    <RankBadge tier={me.tier} division={n} size={38} glow={here} />
                  </View>
                  <Text style={[styles.stepName, here && { fontFamily: fonts.bold, color: colors.text }]}>
                    {me.tierLabel} {n}
                  </Text>
                  <Text style={[styles.stepState, { color: here ? colors.accent : n < me.division ? colors.up : colors.tertiary }]}>
                    {here ? "You're here" : n < me.division ? "Cleared" : `${toGo + 100 * (n - me.division - 1)} RP away`}
                  </Text>
                </View>
              );
            })}
          </View>

          {nextTier && (
            <Pressable style={styles.nextTier} onPress={() => router.push("/ranks")} accessibilityRole="link" testID="profile-next-tier">
              <RankBadge tier={nextTier.key} division={1} size={40} glow={false} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.nextTitle}>Next tier: {nextTier.label}</Text>
                <Text style={styles.nextDetail}>
                  {formatPoints(me.pointsToNext)} rating away · {nextTier.multiplier}x points
                </Text>
              </View>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.tertiary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M9 6l6 6-6 6" />
              </Svg>
            </Pressable>
          )}
        </View>

        <View style={{ marginTop: 26 }}>
          <PerformanceChart deviceId={deviceId} now={now} />
        </View>

        <View style={styles.highlights}>
          <View style={styles.highlight}>
            <Text style={styles.highlightLabel}>AI fooled</Text>
            <Text style={styles.highlightValue} testID="profile-ai-fooled">
              {stats ? (stats.aiFooledPercent === null ? "–" : `${stats.aiFooledPercent}%`) : " "}
            </Text>
          </View>
          <View style={styles.highlight}>
            <Text style={styles.highlightLabel}>Labels verified</Text>
            <Text style={styles.highlightValue} testID="profile-labels-verified">
              {stats ? formatPoints(stats.labelsVerified) : " "}
            </Text>
          </View>
        </View>

        <View style={styles.matches}>
          <Text style={styles.sectionTitle}>Recent matches</Text>
          {activity && matches.length === 0 && <Text style={styles.empty}>Play a round and it shows up here.</Text>}
          {matches.map((match) => {
            const rp = Math.round(match.ratingDelta * RP_PER_RATING);
            return (
              <View key={match.at} style={styles.match} testID="profile-match">
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.matchGame}>{GAME_TITLES[match.game]}</Text>
                  <Text style={styles.matchDetail} numberOfLines={1}>
                    {dayLabel(match.at, now)} ·{" "}
                    {match.game === "unpredictable" ? `fooled the AI on ${match.wins} of ${match.rounds}` : match.note.replace(/^Demo history: /, "")}
                  </Text>
                </View>
                <View style={[styles.pill, { backgroundColor: rp < 0 ? colors.down : colors.up }]}>
                  <Text style={styles.pillText}>
                    {rp < 0 ? "−" : "+"}
                    {Math.abs(rp)} RP
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Sheet visible={editing} onClose={() => setEditing(false)} label="Edit avatar">
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Edit avatar</Text>
          <Pressable style={styles.done} onPress={() => setEditing(false)} accessibilityRole="button" testID="avatar-done">
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
        <View style={{ alignSelf: "center" }}>
          <Avatar color={avatar.color} frame={avatar.frame} aura={avatar.aura} size={104} />
        </View>
        <View style={styles.tabs} accessibilityRole="tablist">
          {EDITOR_TABS.map((key) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
              hitSlop={{ top: 4, bottom: 4 }}
              style={[styles.tab, tab === key && { backgroundColor: "#2A2842" }]}
              testID={`avatar-tab-${key.toLowerCase()}`}
            >
              <Text style={[styles.tabText, tab === key && { color: colors.text }]}>{key}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.options}>
          {options.map((option, index) => (
            <View key={option.label} style={{ alignItems: "center", gap: 6 }}>
              <Pressable
                onPress={option.pick}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: option.on }}
                style={[styles.option, option.on && { borderColor: colors.text }]}
                testID={`avatar-option-${index}`}
              >
                <Swatch tab={tab} index={index} c1={tab === "Color" ? AVATAR_PALETTES[index].c1 : palette.c1} c2={tab === "Color" ? AVATAR_PALETTES[index].c2 : palette.c2} />
              </Pressable>
              <Text style={styles.optionLabel}>{option.label}</Text>
            </View>
          ))}
        </View>
      </Sheet>
      <Toast message={toast} onDone={() => setToast(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 4, paddingBottom: 36 },
  pen: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  identity: { alignItems: "center", gap: 10, paddingTop: 6, paddingHorizontal: 20 },
  name: { fontFamily: fonts.headingMedium, fontSize: 24, letterSpacing: -0.3, color: colors.text },
  joined: { fontFamily: fonts.body, fontSize: 13.5, color: colors.tertiary },
  rankCard: {
    marginTop: 18,
    marginHorizontal: 20,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderRadius: 26,
    backgroundColor: "#14131F",
    borderWidth: 1,
    borderColor: colors.chipBorder,
    alignItems: "center",
    gap: 6,
    overflow: "hidden",
  },
  rankName: { fontFamily: fonts.heading, fontSize: 30, letterSpacing: -0.5, color: colors.text },
  ratingLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.tertiary },
  ratingValue: { fontFamily: fonts.semibold, color: colors.text, fontVariant: ["tabular-nums"] },
  rpBlock: { alignSelf: "stretch", marginTop: 12, gap: 8 },
  rpRow: { flexDirection: "row", justifyContent: "space-between" },
  rpText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text, fontVariant: ["tabular-nums"] },
  steps: { alignSelf: "stretch", flexDirection: "row", marginTop: 16 },
  step: { flex: 1, alignItems: "center", gap: 4 },
  stepIdle: { padding: 3.5 },
  stepHere: { padding: 2, borderRadius: 14, borderWidth: 1.5, borderColor: colors.periwinkle },
  stepName: { fontFamily: fonts.semibold, fontSize: 12, color: colors.secondary },
  stepState: { fontFamily: fonts.semibold, fontSize: 11 },
  nextTier: {
    alignSelf: "stretch",
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.raised,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
  },
  nextTitle: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  nextDetail: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tertiary },
  highlights: { flexDirection: "row", gap: 10, paddingTop: 14, paddingHorizontal: 20 },
  highlight: { flex: 1, padding: 14, borderRadius: 18, backgroundColor: colors.surface, gap: 4 },
  highlightLabel: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tertiary },
  highlightValue: { fontFamily: fonts.headingMedium, fontSize: 24, color: colors.text },
  matches: { paddingTop: 22, paddingHorizontal: 20 },
  sectionTitle: { fontFamily: fonts.headingMedium, fontSize: 19, color: colors.text, marginBottom: 4 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.tertiary, paddingVertical: 12 },
  match: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  matchGame: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  matchDetail: { fontFamily: fonts.body, fontSize: 13, color: colors.tertiary },
  pill: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: 999 },
  pillText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bg, fontVariant: ["tabular-nums"] },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontFamily: fonts.headingMedium, fontSize: 21, color: colors.text },
  done: { height: 40, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.text, justifyContent: "center" },
  doneText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ctaText },
  tabs: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 999, backgroundColor: "#0F0F18" },
  tab: { flex: 1, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  tabText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.tertiary },
  options: { flexDirection: "row", gap: 12, justifyContent: "center" },
  option: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#0F0F18",
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tertiary },
});
