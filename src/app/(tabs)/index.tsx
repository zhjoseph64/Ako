import { useQuery } from "convex/react";
import { router } from "expo-router";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

import { Avatar } from "@/platform/Avatar";
import { GameArt } from "@/platform/GameArt";
import { GAMES, type Game } from "@/platform/games";
import { AkoMark, PeopleIcon, PointsGem } from "@/platform/icons";
import { RankBadge } from "@/platform/RankBadge";
import { colors, ctaGradient, fonts, formatPoints, radii, space } from "@/platform/theme";
import { Toast } from "@/platform/Toast";
import { useMe } from "@/platform/useMe";
import { api } from "../../../convex/_generated/api";
import { PROMPT_SETS } from "../../../convex/unpredictable/seed";
import { dayInfo } from "../../../convex/unpredictable/text";

type LiveCounts = { unpredictable: number; jailbreak: number } | undefined;

function useLoop(duration: number, from: number, to: number, reverse: boolean, linear = false) {
  const value = useSharedValue(from);
  useEffect(() => {
    value.value = withRepeat(
      withTiming(to, { duration, easing: linear ? Easing.linear : Easing.inOut(Easing.ease) }),
      -1,
      reverse,
    );
  }, [value, duration, to, reverse, linear]);
  return value;
}

function IconButton({ children, onPress, label }: { children: ReactNode; onPress: () => void; label: string }) {
  return (
    <Pressable style={styles.iconButton} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {children}
    </Pressable>
  );
}

function PlayCircle() {
  return (
    <Svg width={40} height={40} viewBox="0 0 40 40">
      <Defs>
        <LinearGradient id="play-cta" x1="0" y1="0.2" x2="1" y2="0.8">
          <Stop offset="0" stopColor={ctaGradient[0]} />
          <Stop offset="0.6" stopColor={ctaGradient[1]} />
          <Stop offset="1" stopColor={ctaGradient[2]} />
        </LinearGradient>
      </Defs>
      <Circle cx="20" cy="20" r="20" fill="url(#play-cta)" />
      <Path d="M15.5 12.5v15l13-7.5z" fill={colors.ctaText} />
    </Svg>
  );
}

function LiveHero({ arena }: { arena: ReturnType<typeof useArena> }) {
  const pip = useLoop(800, 1, 0.35, true);
  const spin = useLoop(14_000, 0, 360, false, true);
  const pipStyle = useAnimatedStyle(() => ({ opacity: pip.value }));
  const orbitStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const knights = arena?.knights ?? 0;
  const status = arena?.defeated ? "Boss defeated" : `Round ${arena?.round ?? 1}`;

  return (
    <Pressable
      style={styles.hero}
      onPress={() => router.push("/jailbreak")}
      testID="home-hero-jailbreak"
      accessibilityRole="button"
      accessibilityLabel="Join Jailbreak Boss"
    >
      <View style={styles.heroArt}>
        <Svg width="100%" height="100%" viewBox="0 -30 350 168" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="hero-bg" cx="50%" cy="40%" rx="60%" ry="60%">
              <Stop offset="0" stopColor="#1C2A4A" />
              <Stop offset="0.7" stopColor="#0E1322" />
              <Stop offset="1" stopColor="#0E1322" />
            </RadialGradient>
          </Defs>
          <Rect y="-30" width="350" height="168" fill="url(#hero-bg)" />
            <Rect x="145" y="24" width="60" height="60" rx="17" fill="none" stroke="#4B5BC9" strokeWidth={1.4} />
            <Rect x="155" y="34" width="40" height="40" rx="12" fill="none" stroke="#6CB8D6" strokeWidth={1.4} />
            <Rect x="164" y="43" width="22" height="22" rx="7" fill="#1E2A44" stroke="#79E2D6" strokeWidth={1.4} />
            <Circle cx="175" cy="51.5" r="3.2" fill="#79E2D6" />
            <Path d="M175 54 L175 59.5" stroke="#79E2D6" strokeWidth={2.6} strokeLinecap="round" />
            {[
              [40, 26], [72, 78], [290, 30], [314, 80], [22, 64], [332, 50],
            ].map(([cx, cy]) => (
              <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.4" fill="#4A4766" />
            ))}
        </Svg>
        <Animated.View style={[styles.orbit, orbitStyle]} pointerEvents="none">
          <Svg width={92} height={92} viewBox="129 8 92 92">
            <Circle cx="175" cy="10" r="2.6" fill="#F0A9DC" />
            <Circle cx="219" cy="54" r="2.6" fill="#79E2D6" />
            <Circle cx="175" cy="98" r="2.6" fill="#C9B8FF" />
            <Circle cx="131" cy="54" r="2.6" fill="#8E9BF0" />
            <Circle cx="206" cy="23" r="2.2" fill="#9FD9E6" />
            <Circle cx="144" cy="85" r="2.2" fill="#F0A9DC" />
            <Circle cx="206" cy="85" r="2.2" fill="#C9B8FF" />
            <Circle cx="144" cy="23" r="2.2" fill="#79E2D6" />
          </Svg>
        </Animated.View>
        <View style={[styles.heroPill, styles.livePill]}>
          <Animated.View style={[styles.pip, pipStyle]} />
          <Text style={styles.livePillText}>LIVE ARENA</Text>
        </View>
        <View style={[styles.heroPill, styles.statusPill]}>
          <Text style={styles.statusPillText}>{status}</Text>
        </View>
      </View>
      <View style={styles.heroFooter}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.heroTitle}>Jailbreak Boss</Text>
          <Text style={styles.heroSub} numberOfLines={1}>
            {knights > 0 ? `${knights} ${knights === 1 ? "knight" : "knights"} in the arena` : "Be the first knight in"}
            {arena?.bossName ? ` · ${arena.bossName}` : ""}
          </Text>
        </View>
        <View style={styles.joinButton}>
          <Text style={styles.joinText}>Join</Text>
        </View>
      </View>
    </Pressable>
  );
}

function useArena(now: number) {
  return useQuery(api.platform.home.jailbreakArena, { now });
}

function ContinueCard({ deviceId, now }: { deviceId: string | null; now: number }) {
  const summary = useQuery(api.unpredictable.game.summary, deviceId ? { deviceId } : "skip");
  const { day, set } = dayInfo(now, PROMPT_SETS.length);
  const today = summary && summary.day === day ? summary : null;
  const total = today?.total || PROMPT_SETS[set].length;
  const outcomes = Array.from({ length: total }, (_, i) => today?.rounds[i]?.outcome ?? null);
  const done = outcomes.filter((o) => o !== null).length;
  const escaped = today?.escaped ?? 0;
  const subtitle = !today || done === 0
    ? `Today's ${total} prompts are ready`
    : today.finished
      ? `Done for today · AI fooled on ${escaped} of ${total}`
      : `${done} of ${total} done · AI fooled on ${escaped}`;
  const barColor = { escaped: colors.up, predicted: colors.down, void: "#4A4766" } as const;

  return (
    <Pressable
      style={styles.continueCard}
      onPress={() => router.push(today?.finished ? "/unpredictable/result" : "/unpredictable")}
      testID="home-continue-unpredictable"
      accessibilityRole="button"
      accessibilityLabel="Continue Unpredictable"
    >
      <View style={styles.continueThumb}>
        <Svg width={62} height={62} viewBox="0 0 62 62">
          <Path d="M14 22 L22 31 L14 40 L6 31 Z" fill="#C27BD0" opacity={0.8} />
          <Rect x="20" y="12" width="22" height="38" rx="7" fill="#2A2342" stroke="#C9B8FF" strokeWidth={1.4} />
          <Rect x="26" y="28" width="10" height="8" rx="2" fill="none" stroke="#F0B3E2" strokeWidth={1.6} />
          <Path d="M28 28 v-3 a3 3 0 0 1 6 0 v3" fill="none" stroke="#F0B3E2" strokeWidth={1.6} />
          <Path d="M48 22 L56 31 L48 40 L40 31 Z" fill="#6CB8D6" opacity={0.8} />
        </Svg>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.continueTop}>
          <Text style={styles.continueTitle}>Unpredictable</Text>
          <Text style={styles.continueTag}>Daily</Text>
        </View>
        <Text style={styles.continueSub} testID="home-continue-progress">
          {subtitle}
        </Text>
        <View style={styles.bars}>
          {outcomes.map((outcome, i) => (
            <View key={i} style={[styles.bar, outcome && { backgroundColor: barColor[outcome] }]} />
          ))}
        </View>
      </View>
      <PlayCircle />
    </Pressable>
  );
}

function liveMeta(game: Game, live: LiveCounts, knights: number) {
  if (!game.live) return "Coming soon";
  const count = game.live === "jailbreak" ? Math.max(knights, live?.jailbreak ?? 0) : (live?.unpredictable ?? 0);
  return count > 0 ? `${count} playing now` : "Play now";
}

function GameTile({ game, meta, onPress }: { game: Game; meta: string; onPress: () => void }) {
  return (
    <Pressable
      style={styles.tile}
      onPress={onPress}
      testID={`home-tile-${game.key}`}
      accessibilityRole="button"
      accessibilityLabel={game.live ? `Play ${game.title}` : `${game.title}, coming soon`}
    >
      <View style={[styles.thumb, { backgroundColor: game.bg }]}>
        <GameArt kind={game.art} />
        {game.isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newText}>NEW</Text>
          </View>
        )}
      </View>
      <Text style={styles.tileTitle}>{game.title}</Text>
      <View style={styles.meta}>
        <PeopleIcon color={game.live ? colors.tertiary : colors.muted} />
        <Text style={[styles.metaText, !game.live && { color: colors.muted }]}>{meta}</Text>
      </View>
    </Pressable>
  );
}

const CHART_FILTERS = ["Most played", "Top paying", "Trending"] as const;

function Charts({ live, knights, multiplier, open }: { live: LiveCounts; knights: number; multiplier: number; open: (game: Game) => void }) {
  const [filter, setFilter] = useState<(typeof CHART_FILTERS)[number]>("Most played");
  const players = (game: Game) =>
    game.live === "jailbreak" ? Math.max(knights, live?.jailbreak ?? 0) : game.live ? (live?.unpredictable ?? 0) : -1;
  const rows = [...GAMES].sort((a, b) =>
    filter === "Top paying"
      ? b.basePay - a.basePay
      : filter === "Trending"
        ? Number(!!b.isNew) - Number(!!a.isNew) || players(b) - players(a)
        : players(b) - players(a) || Number(!!b.live) - Number(!!a.live),
  );

  return (
    <View style={styles.charts}>
      <View style={styles.filters}>
        {CHART_FILTERS.map((name) => (
          <Pressable
            key={name}
            onPress={() => setFilter(name)}
            style={[styles.filter, filter === name && styles.filterOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === name }}
          >
            <Text style={[styles.filterText, filter === name && styles.filterTextOn]}>{name}</Text>
          </Pressable>
        ))}
      </View>
      {rows.map((game, index) => (
        <Pressable key={game.key} style={styles.chartRow} onPress={() => open(game)} testID={`chart-${game.key}`}>
          <Text style={styles.chartRank}>{index + 1}</Text>
          <View style={[styles.chartThumb, { backgroundColor: game.bg }]}>
            <GameArt kind={game.art} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.chartTitle}>{game.title}</Text>
            <Text style={styles.chartMeta}>
              {game.live ? `${liveMeta(game, live, knights)} · ${game.cadence.toLowerCase()}` : "Coming soon"}
            </Text>
          </View>
          <Text style={[styles.chartPay, !game.live && { color: colors.muted }]}>
            {formatPoints(Math.round(game.basePay * multiplier))} pts
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function Home() {
  const { deviceId, now, me } = useMe();
  const live = useQuery(api.platform.leaderboard.liveCounts, { now });
  const arena = useArena(now);
  const [tab, setTab] = useState<"For you" | "Charts">("For you");
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const knights = arena?.knights ?? 0;
  const open = (game: Game) => (game.href ? router.push(game.href) : setToast(`${game.title} is coming soon`));

  return (
    <SafeAreaView edges={["top"]} style={styles.screen} testID="home">
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <AkoMark />
            <Text style={styles.brandText}>Ako</Text>
          </View>
          <View style={styles.headerRight}>
            <IconButton label="Search" onPress={() => setToast("Search is coming soon")}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={2} strokeLinecap="round">
                <Circle cx="11" cy="11" r="7" />
                <Path d="M20 20l-4-4" />
              </Svg>
            </IconButton>
            <Pressable
              style={styles.pointsChip}
              onPress={() => router.navigate("/wallet")}
              testID="home-points"
              accessibilityRole="button"
              accessibilityLabel={me ? `${me.points} points, open wallet` : "Open wallet"}
            >
              <PointsGem />
              <Text style={styles.pointsText}>{me ? formatPoints(me.points) : "–"}</Text>
            </Pressable>
            <IconButton label="Notifications" onPress={() => setToast("Notifications are coming soon")}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" />
                <Path d="M10 20a2.2 2.2 0 0 0 4 0" />
              </Svg>
            </IconButton>
          </View>
        </View>

        <View style={styles.tabs}>
          {(["For you", "Charts"] as const).map((name) => (
            <Pressable
              key={name}
              onPress={() => setTab(name)}
              style={[styles.tab, tab === name && styles.tabOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === name }}
              testID={`home-tab-${name === "For you" ? "foryou" : "charts"}`}
            >
              <Text style={[styles.tabText, tab === name && styles.tabTextOn]}>{name}</Text>
            </Pressable>
          ))}
        </View>

        {tab === "For you" ? (
          <>
            {me && (
              <Pressable style={styles.me} onPress={() => router.navigate("/profile")} testID="home-me">
                <Avatar color={me.avatar.color} />
                <Text style={styles.name} numberOfLines={1}>
                  {me.name}
                </Text>
                <RankBadge tier={me.tier} division={me.division} size={30} />
                {me.streakDays > 0 && (
                  <View style={styles.streak}>
                    <Svg width={13} height={13} viewBox="0 0 24 24" fill="#FFB38A">
                      <Path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z" />
                    </Svg>
                    <Text style={styles.streakText}>{me.streakDays}-day streak</Text>
                  </View>
                )}
              </Pressable>
            )}
            <LiveHero arena={arena} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Continue playing</Text>
              <ContinueCard deviceId={deviceId} now={now} />
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recommended for you</Text>
              <View style={styles.grid}>
                {GAMES.map((game) => (
                  <GameTile key={game.key} game={game} meta={liveMeta(game, live, knights)} onPress={() => open(game)} />
                ))}
              </View>
            </View>
          </>
        ) : (
          <Charts live={live} knights={knights} multiplier={me?.multiplier ?? 1} open={open} />
        )}
      </ScrollView>
      <Toast message={toast} onDone={clearToast} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: space.page, paddingRight: 16, paddingTop: 8, paddingBottom: 4 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, letterSpacing: -0.2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  pointsChip: {
    height: 36,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.chip,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pointsText: { fontFamily: fonts.bold, fontSize: 14, color: colors.text, fontVariant: ["tabular-nums"] },
  tabs: { flexDirection: "row", marginTop: 6, marginHorizontal: space.page, borderBottomWidth: 1, borderBottomColor: "#22213A" },
  tab: { flex: 1, height: 46, alignItems: "center", justifyContent: "center", borderBottomWidth: 2.5, borderBottomColor: "transparent", marginBottom: -1 },
  tabOn: { borderBottomColor: colors.text },
  tabText: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.muted },
  tabTextOn: { color: colors.text },
  me: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18, marginHorizontal: space.page },
  name: { fontFamily: fonts.heading, fontSize: 24, color: colors.text, letterSpacing: -0.4, flexShrink: 1 },
  streak: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: "#2A1E22" },
  streakText: { fontFamily: fonts.bold, fontSize: 12.5, color: "#FFC9A8" },
  hero: { marginTop: 18, marginHorizontal: space.page, borderRadius: 24, overflow: "hidden", backgroundColor: "#111827", borderWidth: 1, borderColor: "#1F2A40" },
  heroArt: { height: 168, alignItems: "center", justifyContent: "center" },
  orbit: { width: 92, height: 92 },
  heroPill: { position: "absolute", top: 12, flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: radii.pill },
  livePill: { left: 12, backgroundColor: "rgba(58,30,51,0.92)" },
  pip: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FF8AD0" },
  livePillText: { fontFamily: fonts.bold, fontSize: 12, color: "#FFC2E9", letterSpacing: 0.4 },
  statusPill: { right: 12, backgroundColor: "rgba(11,11,20,0.75)" },
  statusPillText: { fontFamily: fonts.bold, fontSize: 12, color: colors.text, fontVariant: ["tabular-nums"] },
  heroFooter: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16 },
  heroTitle: { fontFamily: fonts.heading, fontSize: 21, color: colors.text, letterSpacing: -0.3 },
  heroSub: { fontFamily: fonts.medium, fontSize: 13, color: colors.secondary },
  joinButton: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: radii.pill, backgroundColor: "#9FD9E6" },
  joinText: { fontFamily: fonts.bold, fontSize: 15, color: "#0A0D16" },
  section: { paddingTop: 24, paddingHorizontal: space.page, gap: 12 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.text, letterSpacing: -0.3 },
  continueCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 10, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  continueThumb: { width: 76, height: 76, borderRadius: 16, backgroundColor: "#1B1730", alignItems: "center", justifyContent: "center" },
  continueTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  continueTitle: { fontFamily: fonts.bold, fontSize: 16.5, color: colors.text },
  continueTag: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.tertiary },
  continueSub: { fontFamily: fonts.medium, fontSize: 13, color: colors.secondary },
  bars: { flexDirection: "row", gap: 3 },
  bar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.chipBorder },
  grid: { flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 14 },
  tile: { width: "47.5%", flexGrow: 1, gap: 7 },
  thumb: { aspectRatio: 1.25, borderRadius: radii.tile, overflow: "hidden" },
  newBadge: { position: "absolute", top: 8, left: 8, paddingVertical: 3, paddingHorizontal: 8, borderRadius: radii.pill, backgroundColor: colors.text },
  newText: { fontFamily: fonts.bold, fontSize: 11, color: colors.ctaText, letterSpacing: 0.3 },
  tileTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, lineHeight: 18 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.tertiary, flexShrink: 1 },
  charts: { paddingTop: 16, paddingHorizontal: space.page },
  filters: { flexDirection: "row", gap: 6, marginBottom: 8 },
  filter: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.chipBorder, minHeight: 36, justifyContent: "center" },
  filterOn: { backgroundColor: colors.text, borderColor: colors.text },
  filterText: { fontFamily: fonts.bold, fontSize: 13, color: colors.tertiary },
  filterTextOn: { color: colors.ctaText },
  chartRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider, minHeight: 44 },
  chartRank: { width: 20, textAlign: "center", fontFamily: fonts.heading, fontSize: 17, color: colors.tertiary },
  chartThumb: { width: 64, height: 52, borderRadius: 12, overflow: "hidden" },
  chartTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  chartMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.tertiary },
  chartPay: { fontFamily: fonts.bold, fontSize: 13, color: colors.up },
});
