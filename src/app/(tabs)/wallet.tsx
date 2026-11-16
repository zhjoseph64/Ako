import { useAction, useQuery } from "convex/react";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";

import { colors, fonts, formatCents, formatPoints, radii, space } from "@/platform/theme";
import { Body, Card, Heading, Screen } from "@/platform/ui";
import { useMe } from "@/platform/useMe";
import { api } from "../../../convex/_generated/api";
import { TOKEN_PACK } from "../../../convex/whop/pack";

export default function Wallet() {
  const { me, deviceId, secret, now } = useMe();
  const startCheckout = useAction(api.whop.checkout.start);
  const lastPurchase = useQuery(api.whop.credit.lastPurchase, deviceId ? { deviceId } : "skip");
  const [state, setState] = useState<"idle" | "opening" | "waiting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [purchaseAtOpen, setPurchaseAtOpen] = useState<number | null>(null);
  const credited = lastPurchase && lastPurchase.createdAt > (purchaseAtOpen ?? now - 120_000) ? lastPurchase : null;

  const getTokens = async () => {
    if (!deviceId || !secret || state === "opening") return;
    setError(null);
    setState("opening");
    setPurchaseAtOpen(lastPurchase?.createdAt ?? 0);
    const tab = Platform.OS === "web" ? window.open("", "_blank") : null;
    try {
      const url = await startCheckout({
        deviceId,
        secret,
        returnUrl: Platform.OS === "web" ? `${window.location.origin}/wallet` : undefined,
      });
      setState("waiting");
      if (Platform.OS !== "web") await WebBrowser.openBrowserAsync(url);
      else if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (cause) {
      tab?.close();
      setState("idle");
      setError(cause instanceof Error && cause.message.includes("not configured") ? "Whop is not configured yet" : "Could not start checkout. Try again.");
    }
  };

  return (
    <Screen testID="wallet">
      <Heading size={28}>Wallet</Heading>
      <Card>
        <Body color={colors.tertiary}>Balance</Body>
        <Text style={styles.balance} testID="wallet-balance">
          {me ? formatCents(me.balanceCents) : "–"}
        </Text>
        <Body testID="wallet-points">{me ? `${formatPoints(me.points)} points · 100 points = $1.00` : " "}</Body>
      </Card>
      <Card>
        <Body color={colors.tertiary}>Token pack</Body>
        <Text style={styles.cashed}>{formatPoints(TOKEN_PACK.tokens)} tokens</Text>
        <Body>{`$${TOKEN_PACK.priceUsd.toFixed(2)} · adds ${formatPoints(TOKEN_PACK.tokens)} points · checkout by Whop`}</Body>
        <Pressable
          style={({ pressed }) => [styles.cta, (pressed || state === "opening") && { opacity: 0.7 }]}
          onPress={getTokens}
          disabled={!deviceId || !secret || state === "opening"}
          accessibilityRole="button"
          testID="wallet-get-tokens"
        >
          <Text style={styles.ctaText}>{state === "opening" ? "Opening checkout…" : "Get tokens"}</Text>
        </Pressable>
        {credited ? (
          <Body color={colors.up} testID="wallet-purchase-status">{`+${formatPoints(credited.tokens)} points added`}</Body>
        ) : state === "waiting" ? (
          <Body testID="wallet-purchase-status">Waiting for your payment to confirm…</Body>
        ) : error ? (
          <Body color={colors.down} testID="wallet-purchase-status">
            {error}
          </Body>
        ) : null}
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
  cta: {
    minHeight: space.touch,
    borderRadius: radii.pill,
    backgroundColor: colors.rating,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  ctaText: { fontFamily: fonts.bold, fontSize: 15, color: colors.ctaText },
});
