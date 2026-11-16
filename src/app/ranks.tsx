import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RankBadge } from "@/platform/RankBadge";
import { colors, fonts, formatPoints } from "@/platform/theme";
import { TopBar } from "@/platform/ui";
import { useMe } from "@/platform/useMe";
import { TIER_SPAN, TIERS, type TierKey } from "../../convex/platform/ranks";

const LADDER = [...TIERS].reverse();

export default function Ranks() {
  const { me } = useMe();
  const [picked, setPicked] = useState<TierKey | null | undefined>(undefined);
  const open = picked === undefined ? (me?.tier ?? null) : picked;

  return (
    <SafeAreaView edges={["top"]} style={styles.screen} testID="ranks">
      <ScrollView contentContainerStyle={styles.content}>
        <TopBar fallback="/profile" />
        <View style={styles.intro}>
          <Text style={styles.title}>Ranks</Text>
          <Text style={styles.lead}>
            Climb by fooling the AI and getting your labels verified. Every tier multiplies the points you earn per round.
          </Text>
        </View>

        <View style={styles.list}>
          {LADDER.map((tier) => {
            const isYou = me?.tier === tier.key;
            const expanded = open === tier.key;
            const top = tier.key === "singular";
            return (
              <View key={tier.key} style={[styles.card, isYou && styles.cardYou]} testID={`ranks-tier-${tier.key}`}>
                <Pressable
                  style={styles.row}
                  onPress={() => setPicked(expanded ? null : tier.key)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  testID={`ranks-toggle-${tier.key}`}
                >
                  <RankBadge tier={tier.key} division={isYou && me ? me.division : 3} size={58} glow={isYou} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name}>{tier.label}</Text>
                      {isYou && (
                        <View style={styles.you}>
                          <Text style={styles.youText}>YOU</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.range}>
                      {top ? "Top 500 players" : `${formatPoints(tier.min)} – ${formatPoints(tier.min + TIER_SPAN - 1)}`}
                    </Text>
                  </View>
                  <View style={[styles.pill, isYou && { backgroundColor: colors.accent }]}>
                    <Text style={[styles.pillText, isYou && { color: colors.ctaText }]}>
                      {Number.isInteger(tier.multiplier) ? tier.multiplier.toFixed(1) : tier.multiplier}x
                    </Text>
                  </View>
                </Pressable>
                {expanded && (
                  <View style={styles.divisions}>
                    {[1, 2, 3].map((n) => {
                      const mine = isYou && me?.division === n;
                      return (
                        <View key={n} style={[styles.division, mine && styles.divisionMine]} testID={`ranks-division-${tier.key}-${n}`}>
                          <RankBadge tier={tier.key} division={n} size={72} glow={false} />
                          <Text style={styles.divisionName}>
                            {tier.label} {n}
                          </Text>
                          <Text style={styles.divisionFrom}>
                            {top ? "Top 500" : `from ${formatPoints(Math.ceil(tier.min + ((n - 1) * TIER_SPAN) / 3))}`}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.how}>
          <Text style={styles.howTitle}>How points turn into money</Text>
          <View style={styles.howRow}>
            <Text style={styles.howLabel}>Base points per win</Text>
            <Text style={styles.howValue}>up to 300</Text>
          </View>
          <View style={styles.howRow}>
            <Text style={styles.howLabel}>Your multiplier{me ? ` (${me.tierLabel})` : ""}</Text>
            <Text style={[styles.howValue, { color: colors.accent }]} testID="ranks-multiplier">× {me?.multiplier ?? 1}</Text>
          </View>
          <View style={[styles.howRow, styles.howLast]}>
            <Text style={styles.howLabel}>Cash value</Text>
            <Text style={[styles.howValue, { fontFamily: fonts.bold, color: colors.up }]}>100 pts = $1.00</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 4, paddingBottom: 36 },
  intro: { paddingTop: 4, paddingHorizontal: 20, gap: 6 },
  title: { fontFamily: fonts.heading, fontSize: 32, letterSpacing: -0.6, color: colors.text },
  lead: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21.75, color: colors.secondary },
  list: { marginTop: 18, paddingHorizontal: 20, gap: 8 },
  card: { borderRadius: 20, overflow: "hidden", backgroundColor: "#13131D", borderWidth: 1, borderColor: colors.divider },
  cardYou: { backgroundColor: "#1A1930", borderColor: "#4A4380" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 8, paddingLeft: 6, paddingRight: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontFamily: fonts.headingMedium, fontSize: 17, color: colors.text },
  you: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: colors.accent },
  youText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.3, color: colors.ctaText },
  range: { fontFamily: fonts.body, fontSize: 13, color: colors.tertiary, fontVariant: ["tabular-nums"] },
  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.border },
  pillText: { fontFamily: fonts.bold, fontSize: 13, color: "#E6E2F5" },
  divisions: { flexDirection: "row", gap: 8, paddingTop: 4, paddingHorizontal: 12, paddingBottom: 14 },
  division: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 16,
    backgroundColor: "#0F0F18",
    borderWidth: 1,
    borderColor: colors.divider,
  },
  divisionMine: { backgroundColor: "#26244A", borderColor: colors.periwinkle },
  divisionName: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  divisionFrom: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tertiary, fontVariant: ["tabular-nums"] },
  how: { marginTop: 18, marginHorizontal: 20, padding: 16, borderRadius: 20, backgroundColor: colors.surface, gap: 10 },
  howTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  howRow: { flexDirection: "row", justifyContent: "space-between" },
  howLast: { paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  howLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.secondary },
  howValue: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
});
