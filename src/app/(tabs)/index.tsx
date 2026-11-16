import { useQuery } from "convex/react";
import { router } from "expo-router";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { Enter, PressableScale, TabScene } from "@/motion";
import { Avatar } from "@/platform/Avatar";
import { FEATURED_IMAGE, GAMES, type Game } from "@/platform/games";
import { AkoMark, PeopleIcon, PointsGem } from "@/platform/icons";
import { RankBadge } from "@/platform/RankBadge";
import { colors, fonts, formatPoints, radii, space } from "@/platform/theme";
import { Toast } from "@/platform/Toast";
import { useMe } from "@/platform/useMe";
import { api } from "../../../convex/_generated/api";
import { PROMPT_SETS } from "../../../convex/unpredictable/seed";
import { dayInfo } from "../../../convex/unpredictable/text";

function IconButton({ children, onPress, label }: { children: ReactNode; onPress: () => void; label: string }) {
  return (
    <PressableScale style={styles.iconButton} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {children}
    </PressableScale>
  );
}

function LivePip() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.35, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.pip, style]} />;
}

type Arena = { bossName: string | null; defeated: boolean; round: number; knights: number } | undefined;

function FeaturedCard({ arena }: { arena: Arena }) {
  const knights = arena?.knights ?? 0;
  return (
    <PressableScale
      scale={0.98}
      style={styles.featured}
      onPress={() => router.push("/jailbreak")}
      testID="home-featured"
      accessibilityRole="button"
      accessibilityLabel="Play Jailbreak Boss"
    >
      <View style={styles.featuredImage}>
        <Image source={FEATURED_IMAGE} style={styles.fill} resizeMode="cover" />
      </View>
      <View style={[styles.pill, styles.livePill]}>
        <LivePip />
        <Text style={styles.livePillText}>LIVE ARENA</Text>
      </View>
      <View style={[styles.pill, styles.statusPill]}>
        <Text style={styles.statusPillText}>{arena?.defeated ? "Boss defeated" : `Round ${arena?.round ?? 1}`}</Text>
      </View>
      <View style={styles.featuredFooter}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.featuredTitle}>Jailbreak Boss</Text>
          <Text style={styles.featuredSub} numberOfLines={1}>
            {knights > 0 ? `${knights} ${knights === 1 ? "knight" : "knights"} in the arena` : "Talk the dragon into breaking its rule"}
          </Text>
        </View>
        <View style={styles.playButton}>
          <Text style={styles.playText}>Play</Text>
        </View>
      </View>
    </PressableScale>
  );
}

function useUnpredictableProgress(deviceId: string | null, now: number) {
  const summary = useQuery(api.unpredictable.game.summary, deviceId ? { deviceId } : "skip");
  const { day, set } = dayInfo(now, PROMPT_SETS.length);
  const today = summary && summary.day === day ? summary : null;
  const total = today?.total || PROMPT_SETS[set].length;
  const outcomes = Array.from({ length: total }, (_, i) => today?.rounds[i]?.outcome ?? null);
  return { outcomes, done: outcomes.filter((o) => o !== null).length, total, finished: !!today?.finished };
}

const BAR_COLOR = { escaped: colors.up, predicted: colors.down, void: "#4A4766" } as const;

function GameTile({ game, index, meta, progress, onPress }: {
  game: Game;
  index: number;
  meta: string;
  progress?: (keyof typeof BAR_COLOR | null)[];
  onPress: () => void;
}) {
  return (
    <Enter index={index} style={styles.tile}>
    <PressableScale
      scale={0.94}
      style={styles.tileInner}
      onPress={onPress}
      testID={`home-tile-${game.key}`}
      accessibilityRole="button"
      accessibilityLabel={game.live ? `Play ${game.title}` : `${game.title}, coming soon`}
    >
      <View style={styles.thumb}>
        <Image source={game.image} style={styles.fill} resizeMode="cover" />
        {game.isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newText}>NEW</Text>
          </View>
        )}
        {game.live && (
          <View style={styles.liveDot}>
            <LivePip />
          </View>
        )}
      </View>
      <Text style={styles.tileTitle} numberOfLines={1}>
        {game.title}
      </Text>
      {progress ? (
        <View style={styles.bars}>
          {progress.map((outcome, i) => (
            <View key={i} style={[styles.bar, outcome && { backgroundColor: BAR_COLOR[outcome] }]} />
          ))}
        </View>
      ) : null}
      <View style={styles.meta}>
        {game.live && <PeopleIcon size={12} color={colors.tertiary} />}
        <Text style={[styles.metaText, !game.live && { color: colors.muted }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </PressableScale>
    </Enter>
  );
}

export default function Home() {
  const { deviceId, now, me } = useMe();
  const live = useQuery(api.platform.leaderboard.liveCounts, { now });
  const arena = useQuery(api.platform.home.jailbreakArena, { now });
  const unpredictable = useUnpredictableProgress(deviceId, now);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  const metaFor = (game: Game) => {
    if (game.live === "unpredictable") {
      if (unpredictable.finished) return "Done for today";
      if (unpredictable.done > 0) return `${unpredictable.done} of ${unpredictable.total} done`;
      const playing = live?.unpredictable ?? 0;
      return playing > 0 ? `${playing} playing` : "Daily · new prompts";
    }
    if (game.live === "jailbreak") {
      const playing = Math.max(arena?.knights ?? 0, live?.jailbreak ?? 0);
      return playing > 0 ? `${playing} playing` : "Live arena";
    }
    return "Coming soon";
  };

  const open = (game: Game) => {
    if (!game.href) return setToast(`${game.title} is coming soon`);
    router.push(game.live === "unpredictable" && unpredictable.finished ? "/unpredictable/result" : game.href);
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.screen} testID="home">
      <TabScene>
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
            <PressableScale
              style={styles.pointsChip}
              onPress={() => router.navigate("/wallet")}
              testID="home-points"
              accessibilityRole="button"
              accessibilityLabel={me ? `${me.points} points, open wallet` : "Open wallet"}
            >
              <PointsGem />
              <Text style={styles.pointsText}>{me ? formatPoints(me.points) : "–"}</Text>
            </PressableScale>
            <IconButton label="Notifications" onPress={() => setToast("Notifications are coming soon")}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" />
                <Path d="M10 20a2.2 2.2 0 0 0 4 0" />
              </Svg>
            </IconButton>
          </View>
        </View>

        {me && (
          <PressableScale scale={0.98} style={styles.me} onPress={() => router.navigate("/profile")} testID="home-me">
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
          </PressableScale>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>For you</Text>
          <FeaturedCard arena={arena} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More games</Text>
          <View style={styles.grid}>
            {GAMES.filter((game) => game.key !== "jailbreak").map((game, index) => (
              <GameTile
                key={game.key}
                index={index}
                game={game}
                meta={metaFor(game)}
                progress={game.live === "unpredictable" && unpredictable.done > 0 ? unpredictable.outcomes : undefined}
                onPress={() => open(game)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
      </TabScene>
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
  me: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, marginHorizontal: space.page },
  name: { fontFamily: fonts.heading, fontSize: 24, color: colors.text, letterSpacing: -0.4, flexShrink: 1 },
  streak: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: "#2A1E22" },
  streakText: { fontFamily: fonts.bold, fontSize: 12.5, color: "#FFC9A8" },
  section: { paddingTop: 22, paddingHorizontal: space.page, gap: 12 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.text, letterSpacing: -0.3 },
  featured: { borderRadius: 24, overflow: "hidden", backgroundColor: "#111827", borderWidth: 1, borderColor: "#1F2A40" },
  featuredImage: { width: "100%", aspectRatio: 1.5, overflow: "hidden" },
  fill: { width: "100%", height: "100%" },
  pill: { position: "absolute", top: 12, flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: radii.pill },
  livePill: { left: 12, backgroundColor: "rgba(58,30,51,0.92)" },
  pip: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FF8AD0" },
  livePillText: { fontFamily: fonts.bold, fontSize: 12, color: "#FFC2E9", letterSpacing: 0.4 },
  statusPill: { right: 12, backgroundColor: "rgba(11,11,20,0.75)" },
  statusPillText: { fontFamily: fonts.bold, fontSize: 12, color: colors.text, fontVariant: ["tabular-nums"] },
  featuredFooter: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16 },
  featuredTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.text, letterSpacing: -0.4 },
  featuredSub: { fontFamily: fonts.medium, fontSize: 13, color: colors.secondary },
  playButton: { paddingVertical: 12, paddingHorizontal: 22, borderRadius: radii.pill, backgroundColor: "#9FD9E6" },
  playText: { fontFamily: fonts.bold, fontSize: 15, color: "#0A0D16" },
  grid: { flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 16 },
  tile: { width: "30.5%", flexGrow: 1, maxWidth: "32%" },
  tileInner: { gap: 5 },
  thumb: { aspectRatio: 1, borderRadius: 16, overflow: "hidden", backgroundColor: colors.raised },
  newBadge: { position: "absolute", top: 6, left: 6, paddingVertical: 2, paddingHorizontal: 6, borderRadius: radii.pill, backgroundColor: colors.text },
  newText: { fontFamily: fonts.bold, fontSize: 9.5, color: colors.ctaText, letterSpacing: 0.3 },
  liveDot: { position: "absolute", top: 8, right: 8, padding: 3, borderRadius: radii.pill, backgroundColor: "rgba(11,11,20,0.75)" },
  tileTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  bars: { flexDirection: "row", gap: 2 },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.chipBorder },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.tertiary, flexShrink: 1 },
});
