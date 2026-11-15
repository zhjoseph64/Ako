import { useQuery } from "convex/react";
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GameArt, type GameArtKind } from "@/platform/GameArt";
import { AkoMark, PeopleIcon, PointsGem } from "@/platform/icons";
import { RankBadge } from "@/platform/RankBadge";
import { colors, fonts, formatPoints, radii } from "@/platform/theme";
import { Avatar, Heading, Screen } from "@/platform/ui";
import { useMe } from "@/platform/useMe";
import { api } from "../../../convex/_generated/api";

const GAMES: { key: "unpredictable" | "jailbreak"; title: string; tagline: string; art: GameArtKind; href: Href; bg: string }[] = [
  { key: "unpredictable", title: "Unpredictable", tagline: "Daily · beat the AI's guess", art: "gut", href: "/unpredictable", bg: "#1B1730" },
  { key: "jailbreak", title: "Jailbreak Boss", tagline: "Multiplayer · break the dragon", art: "breach", href: "/jailbreak", bg: "#0E1322" },
];

export default function Home() {
  const { me } = useMe();
  const live = useQuery(api.platform.leaderboard.liveCounts);

  return (
    <Screen testID="home">
      <View style={styles.header}>
        <View style={styles.brand}>
          <AkoMark />
          <Text style={styles.brandText}>Ako</Text>
        </View>
        <Pressable style={styles.pointsChip} onPress={() => router.navigate("/wallet")} testID="home-points">
          <PointsGem />
          <Text style={styles.pointsText}>{me ? formatPoints(me.points) : "–"}</Text>
        </Pressable>
      </View>

      {me && (
        <Pressable style={styles.me} onPress={() => router.navigate("/profile")} testID="home-me">
          <Avatar color={me.avatar.color} />
          <Text style={styles.name} numberOfLines={1}>
            {me.name}
          </Text>
          <RankBadge tier={me.tier} division={me.division} size={30} />
          {me.streakDays > 0 && (
            <View style={styles.streak}>
              <Text style={styles.streakText}>{me.streakDays}-day streak</Text>
            </View>
          )}
        </Pressable>
      )}

      <Heading>Play now</Heading>
      <View style={styles.grid}>
        {GAMES.map((game) => {
          const playing = live?.[game.key] ?? 0;
          return (
            <Pressable
              key={game.key}
              style={styles.tile}
              onPress={() => router.push(game.href)}
              testID={`home-play-${game.key}`}
              accessibilityRole="button"
              accessibilityLabel={`Play ${game.title}`}
            >
              <View style={[styles.thumb, { backgroundColor: game.bg }]}>
                <GameArt kind={game.art} />
              </View>
              <Text style={styles.tileTitle}>{game.title}</Text>
              <View style={styles.meta}>
                <PeopleIcon color={colors.tertiary} />
                <Text style={styles.metaText}>{playing > 0 ? `${playing} playing now` : game.tagline}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, letterSpacing: -0.2 },
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
  me: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  name: { fontFamily: fonts.heading, fontSize: 24, color: colors.text, letterSpacing: -0.4, flexShrink: 1 },
  streak: { marginLeft: "auto", paddingVertical: 5, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: "#2A1E22" },
  streakText: { fontFamily: fonts.bold, fontSize: 12.5, color: "#FFC9A8" },
  grid: { flexDirection: "row", gap: 12 },
  tile: { flex: 1, gap: 7 },
  thumb: { aspectRatio: 1.25, borderRadius: radii.tile, overflow: "hidden" },
  tileTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  meta: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.tertiary, flexShrink: 1 },
});
