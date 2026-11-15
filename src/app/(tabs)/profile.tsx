import { StyleSheet, Text, View } from "react-native";

import { RankBadge } from "@/platform/RankBadge";
import { colors, fonts, formatPoints, radii } from "@/platform/theme";
import { Avatar, Body, Card, Heading, Screen } from "@/platform/ui";
import { useMe } from "@/platform/useMe";

export default function Profile() {
  const { me } = useMe();
  if (!me) return <Screen testID="profile">{null}</Screen>;

  return (
    <Screen testID="profile">
      <View style={styles.header}>
        <Avatar color={me.avatar.color} size={56} />
        <Heading size={26}>{me.name}</Heading>
      </View>
      <Card>
        <View style={styles.rank}>
          <RankBadge tier={me.tier} division={me.division} size={120} />
          <View style={{ flex: 1, gap: 4 }}>
            <Heading size={24}>
              {me.tierLabel} {me.division}
            </Heading>
            <Body testID="profile-multiplier">{me.multiplier}x points multiplier</Body>
            <Body color={colors.tertiary}>Rating {formatPoints(me.rating)}</Body>
          </View>
        </View>
        <View style={styles.rpRow}>
          <Body color={colors.accent}>RP</Body>
          <Body color={colors.accent} testID="profile-rp">{me.rp} / 100</Body>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${me.rp}%` }]} />
        </View>
        {me.nextTierLabel && (
          <Body color={colors.tertiary}>
            {formatPoints(me.pointsToNext)} rating to {me.nextTierLabel}
          </Body>
        )}
      </Card>
      <Card>
        <Body color={colors.tertiary}>Points</Body>
        <Text style={styles.big}>{formatPoints(me.points)}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  rank: { flexDirection: "row", alignItems: "center", gap: 12 },
  rpRow: { flexDirection: "row", justifyContent: "space-between" },
  track: { height: 10, borderRadius: radii.pill, backgroundColor: colors.raised, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radii.pill, backgroundColor: colors.rating },
  big: { fontFamily: fonts.heading, fontSize: 32, color: colors.text },
});
