import { StyleSheet, Text } from "react-native";

import { colors, fonts, formatCents, formatPoints } from "@/platform/theme";
import { Body, Card, Heading, Screen } from "@/platform/ui";
import { useMe } from "@/platform/useMe";

export default function Wallet() {
  const { me } = useMe();

  return (
    <Screen testID="wallet">
      <Heading size={28}>Wallet</Heading>
      <Card>
        <Body color={colors.tertiary}>Balance</Body>
        <Text style={styles.balance} testID="wallet-balance">
          {me ? formatCents(me.balanceCents) : "–"}
        </Text>
        <Body>{me ? `${formatPoints(me.points)} points · 100 points = $1.00` : " "}</Body>
      </Card>
      <Card>
        <Body color={colors.tertiary}>Cashed out</Body>
        <Text style={styles.cashed}>{me ? formatCents(me.cashedOutCents) : "–"}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  balance: { fontFamily: fonts.heading, fontSize: 44, color: colors.text, letterSpacing: -1 },
  cashed: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
});
