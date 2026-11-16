import { useQuery } from "convex/react";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { Enter, PressableScale, Skeleton, TabScene } from "@/motion";
import { Avatar } from "@/platform/Avatar";
import { PRIZE_ZONE, WEEKLY_POOL_CENTS, WEEKLY_PRIZES, weekEndsIn } from "@/platform/prizes";
import { RankBadge } from "@/platform/RankBadge";
import { colors, fonts, formatPoints } from "@/platform/theme";
import { useMe } from "@/platform/useMe";
import { api } from "../../../convex/_generated/api";
import { TIERS, type TierKey } from "../../../convex/platform/ranks";

type Entry = {
  position: number;
  name: string;
  avatar: { color: string; frame: string; aura: string };
  tier: TierKey;
  division: number;
  points: number;
  isMe: boolean;
};

const PODIUM = {
  1: { avatar: 68, step: 88, ring: "#F0A9DC", badge: 30 },
  2: { avatar: 54, step: 64, ring: "#9FD9E6", badge: 26 },
  3: { avatar: 54, step: 48, ring: "#B9A6FF", badge: 26 },
} as const;

const tierLabel = (tier: TierKey, division: number) => `${TIERS.find((t) => t.key === tier)?.label ?? tier} ${division}`;
const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: cents % 100 === 0 ? 0 : 2, minimumFractionDigits: cents % 100 === 0 ? 0 : 2 })}`;

export default function Leaderboard() {
  const { deviceId, me, now } = useMe();
  const board = useQuery(api.platform.leaderboard.leaderboard, { deviceId: deviceId ?? undefined, now });

  const entries: Entry[] = board?.entries ?? [];
  const podium = [entries[1], entries[0], entries[2]].filter((entry): entry is Entry => entry !== undefined);
  const rest = entries.slice(3);
  const mine = board?.me ?? null;

  let youNote = "Play a round to get on the board";
  if (mine) {
    const above = entries[mine.position - 2];
    const zoneEdge = entries[PRIZE_ZONE - 1];
    if (mine.position === 1) youNote = "You're leading this week";
    else if (mine.position > PRIZE_ZONE && zoneEdge) youNote = `${formatPoints(zoneEdge.points - mine.points + 1)} pts to the prize zone (top ${PRIZE_ZONE})`;
    else if (above) youNote = `${formatPoints(above.points - mine.points + 1)} pts to pass ${above.name}`;
    else youNote = "In the prize zone";
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.screen} testID="leaderboard">
      <TabScene>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Leaderboard</Text>
          <PressableScale style={styles.howButton} onPress={() => router.push("/ranks")} accessibilityRole="link" accessibilityLabel="How ranks work" testID="leaderboard-ranks">
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.secondary} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx="12" cy="12" r="9" />
              <Path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 17h.01" />
            </Svg>
          </PressableScale>
        </View>

        <View style={styles.pool} testID="leaderboard-pool">
          <View style={styles.poolTop}>
            <View style={styles.trophy}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#FFD58A" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
              </Svg>
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={styles.poolLabel}>Weekly prize pool</Text>
              <Text style={styles.poolValue}>{dollars(Math.round(WEEKLY_POOL_CENTS / 100) * 100)}</Text>
            </View>
            <View style={styles.ends}>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={colors.secondary} strokeWidth={2.2} strokeLinecap="round">
                <Circle cx="12" cy="12" r="9" />
                <Path d="M12 7v5l3 2" />
              </Svg>
              <Text style={styles.endsText} testID="leaderboard-ends">{weekEndsIn(now)}</Text>
            </View>
          </View>
          <View style={styles.prizes}>
            {WEEKLY_PRIZES.map((prize) => (
              <View key={prize.place} style={styles.prize}>
                <Text style={styles.prizePlace}>{prize.place}</Text>
                <Text style={styles.prizeValue}>{dollars(prize.cents)}</Text>
              </View>
            ))}
          </View>
        </View>

        {!board && (
          <View style={styles.podium}>
            {[96, 120, 84].map((height, index) => (
              <View key={index} style={styles.podiumColumn}>
                <Skeleton width={56} height={56} radius={28} />
                <Skeleton width="70%" height={12} radius={6} style={{ marginTop: 8 }} />
                <Skeleton height={height} radius={16} style={{ marginTop: 10 }} />
              </View>
            ))}
          </View>
        )}
        {!board && (
          <View style={styles.list}>
            {Array.from({ length: 5 }, (_, index) => (
              <View key={index} style={styles.row}>
                <Skeleton height={38} radius={12} />
              </View>
            ))}
          </View>
        )}

        {board && entries.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>The week just started</Text>
            <Text style={styles.emptyBody}>Win a round to take the top spot.</Text>
          </View>
        )}

        {podium.length > 0 && (
          <View style={styles.podium} accessibilityLabel="Top three">
            {podium.map((entry, index) => {
              const look = PODIUM[entry.position as 1 | 2 | 3];
              const first = entry.position === 1;
              return (
                <Enter
                  key={entry.position}
                  index={index}
                  style={styles.podiumColumn}
                  testID={`leaderboard-podium-${entry.position}`}
                >
                  {first && (
                    <Svg width={26} height={18} viewBox="0 0 26 18" style={{ marginBottom: 2 }}>
                      <Path d="M2 16 L4 4 L9.5 9.5 L13 2 L16.5 9.5 L22 4 L24 16 Z" fill="#FFD58A" stroke="#E8B54E" strokeWidth={1.2} strokeLinejoin="round" />
                    </Svg>
                  )}
                  <View style={{ width: look.avatar + 10, height: look.avatar + 10 }}>
                    <View style={[styles.ring, { borderColor: look.ring, borderRadius: (look.avatar + 10) / 2 }]}>
                      <Avatar color={entry.avatar.color} size={look.avatar} />
                    </View>
                    <View style={styles.podiumBadge}>
                      <RankBadge tier={entry.tier} division={entry.division} size={look.badge} glow={false} />
                    </View>
                  </View>
                  <Text style={[styles.podiumName, entry.isMe && { color: colors.accent }]} numberOfLines={1}>
                    {entry.isMe ? "You" : entry.name}
                  </Text>
                  <Text style={styles.podiumPoints}>{formatPoints(entry.points)} pts</Text>
                  <View style={[styles.step, first ? styles.stepFirst : styles.stepOther, { height: look.step }]}>
                    <Text style={[styles.stepNumber, first && { color: colors.text }]}>{entry.position}</Text>
                  </View>
                </Enter>
              );
            })}
          </View>
        )}

        <View style={styles.list}>
          {rest.map((entry, index) => (
            <Enter
              key={entry.position}
              index={index + 3}
              style={[styles.row, entry.isMe && styles.rowMine]}
              testID={`leaderboard-row-${entry.position}`}
            >
              <Text style={styles.position}>{entry.position}</Text>
              <Avatar color={entry.avatar.color} size={38} />
              <View style={styles.rowText}>
                <View style={styles.nameLine}>
                  <Text style={styles.name} numberOfLines={1}>
                    {entry.isMe ? "You" : entry.name}
                  </Text>
                  <RankBadge tier={entry.tier} division={entry.division} size={22} glow={false} />
                </View>
                <Text style={styles.tier}>{tierLabel(entry.tier, entry.division)}</Text>
              </View>
              <Text style={styles.points}>{formatPoints(entry.points)}</Text>
            </Enter>
          ))}
        </View>
      </ScrollView>
      </TabScene>

      {mine && (
        <View style={styles.youWrap} pointerEvents="box-none">
          <PressableScale style={styles.you} scale={0.98} onPress={() => router.push("/profile")} accessibilityRole="link" testID="leaderboard-you">
            <Text style={styles.youPlace}>#{formatPoints(mine.position)}</Text>
            <Avatar color={me?.avatar.color ?? colors.rating} size={38} />
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1}>
                You{me ? ` · ${me.name}` : ""}
              </Text>
              <Text style={styles.youNote} numberOfLines={1}>
                {youNote}
              </Text>
            </View>
            <Text style={styles.points}>{formatPoints(mine.points)}</Text>
          </PressableScale>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 12, paddingBottom: 104 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  title: { fontFamily: fonts.heading, fontSize: 32, letterSpacing: -0.6, color: colors.text },
  howButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  pool: {
    marginTop: 16,
    marginHorizontal: 20,
    padding: 16,
    gap: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#2E2B4D",
    backgroundColor: colors.surface,
    backgroundImage: "linear-gradient(135deg, #2A2348 0%, #17162A 60%, #15151F 100%)",
  },
  poolTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  trophy: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#3A3150", alignItems: "center", justifyContent: "center" },
  poolLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.tertiary },
  poolValue: { fontFamily: fonts.headingMedium, fontSize: 28, letterSpacing: -0.6, color: colors.text, fontVariant: ["tabular-nums"] },
  ends: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(11,11,20,0.55)",
  },
  endsText: { fontFamily: fonts.semibold, fontSize: 12.5, color: "#E6E2F5", fontVariant: ["tabular-nums"] },
  prizes: { flexDirection: "row", gap: 6 },
  prize: { flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: "rgba(11,11,20,0.55)", alignItems: "center", gap: 1 },
  prizePlace: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.tertiary },
  prizeValue: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text, fontVariant: ["tabular-nums"] },
  empty: { marginTop: 40, alignItems: "center", gap: 4 },
  emptyTitle: { fontFamily: fonts.headingMedium, fontSize: 18, color: colors.text },
  emptyBody: { fontFamily: fonts.body, fontSize: 14, color: colors.tertiary },
  podium: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingTop: 20, paddingHorizontal: 20 },
  podiumColumn: { flex: 1, alignItems: "center", gap: 4 },
  ring: { flex: 1, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  podiumBadge: { position: "absolute", right: -6, bottom: -6 },
  podiumName: { marginTop: 6, fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text, maxWidth: "100%" },
  podiumPoints: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.tertiary, fontVariant: ["tabular-nums"] },
  step: {
    alignSelf: "stretch",
    marginTop: 6,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: "center",
    paddingTop: 8,
  },
  stepFirst: { backgroundImage: "linear-gradient(180deg, #43305F 0%, #241E3D 55%, #0B0B14 100%)" },
  stepOther: { backgroundImage: "linear-gradient(180deg, #24233B 0%, #16162A 60%, #0B0B14 100%)" },
  stepNumber: { fontFamily: fonts.heading, fontSize: 24, color: colors.secondary },
  list: { paddingHorizontal: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowMine: { marginHorizontal: -10, paddingHorizontal: 10, borderRadius: 16, borderBottomWidth: 0, backgroundColor: colors.raised },
  position: { width: 24, fontFamily: fonts.semibold, fontSize: 14, color: colors.tertiary, fontVariant: ["tabular-nums"] },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  tier: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tertiary },
  points: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, fontVariant: ["tabular-nums"] },
  youWrap: { position: "absolute", left: 12, right: 12, bottom: 10 },
  you: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#1F1D38",
    borderWidth: 1,
    borderColor: "#4A4380",
    shadowColor: colors.bg,
    shadowOpacity: 0.9,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
  },
  youPlace: { minWidth: 28, fontFamily: fonts.bold, fontSize: 14, color: colors.accent, fontVariant: ["tabular-nums"] },
  youNote: { fontFamily: fonts.body, fontSize: 12.5, color: colors.secondary },
});
