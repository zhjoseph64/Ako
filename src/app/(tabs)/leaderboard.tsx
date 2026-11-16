import { useQuery } from "convex/react";
import { StyleSheet, Text, View } from "react-native";

import { RankBadge } from "@/platform/RankBadge";
import { colors, fonts, formatPoints } from "@/platform/theme";
import { Avatar } from "@/platform/Avatar";
import { Body, Heading, Screen } from "@/platform/ui";
import { useMe } from "@/platform/useMe";
import { api } from "../../../convex/_generated/api";

export default function Leaderboard() {
  const { deviceId, now } = useMe();
  const board = useQuery(api.platform.leaderboard.leaderboard, { deviceId: deviceId ?? undefined, now });

  return (
    <Screen testID="leaderboard">
      <Heading size={28}>Leaderboard</Heading>
      <Body>
        This week{board?.me ? ` · you're #${board.me.position}` : ""}
      </Body>
      <View>
        {board?.entries.map((entry) => (
          <View key={entry.position} style={[styles.row, entry.isMe && styles.mine]}>
            <Text style={styles.position}>{entry.position}</Text>
            <Avatar color={entry.avatar.color} size={36} />
            <Text style={styles.name} numberOfLines={1}>
              {entry.name}
            </Text>
            <RankBadge tier={entry.tier} division={entry.division} size={28} glow={false} />
            <Text style={styles.points}>{formatPoints(entry.points)}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  mine: { backgroundColor: colors.raised },
  position: { width: 24, textAlign: "center", fontFamily: fonts.heading, fontSize: 16, color: colors.tertiary },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  points: { fontFamily: fonts.bold, fontSize: 14, color: colors.up, fontVariant: ["tabular-nums"] },
});
