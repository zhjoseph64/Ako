import { useAction, useMutation, useQuery } from "convex/react";
import { router, useFocusEffect, useIsFocused } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming, ZoomIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { Sheet } from "@/platform/Sheet";
import { CoinFlight, duration, Enter, haptic, PressableScale, RollingNumber, Skeleton, spring, TabScene } from "@/motion";
import { GAMES } from "@/platform/games";
import { PointsGem } from "@/platform/icons";
import { colors, ctaGradient, fonts, formatCents, formatPoints } from "@/platform/theme";
import { TopBar } from "@/platform/ui";
import { useMe } from "@/platform/useMe";
import { dayLabel, GAME_TITLES, startOfDay, startOfMonth } from "@/platform/when";
import { api } from "../../../convex/_generated/api";
import { TOKEN_PACK } from "../../../convex/whop/pack";

const MIN_CASH_OUT = 100;

const ENTRY_ICONS: Record<string, { d: string; tint: string; bg: string }> = {
  cashout: { d: "M12 5v14M5.5 12.5 12 19l6.5-6.5", tint: colors.down, bg: "#3A2229" },
  purchase: { d: "M12 3 20 12 12 21 4 12z", tint: colors.accent, bg: "#2A2547" },
  leaderboard: { d: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3", tint: "#FFD58A", bg: "#3A3150" },
  default: { d: "M12 3v18M3 12h18", tint: colors.secondary, bg: colors.raised },
};

function Icon({ d, color, size = 20 }: { d: string; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
}

function IconTile({ d, tint, bg }: { d: string; tint: string; bg: string }) {
  return (
    <View style={[styles.tile, { backgroundColor: bg }]}>
      <Icon d={d} color={tint} />
    </View>
  );
}
const METHODS = [
  { name: "Bank account", detail: "Checking ••• 4821 · free" },
  { name: "Instant to debit card", detail: "Visa ••• 0917 · 1.5% fee" },
];

export default function Wallet() {
  const { me, deviceId, secret, now } = useMe();
  const activity = useQuery(
    api.platform.profile.activity,
    deviceId ? { deviceId, dayStart: startOfDay(now), monthStart: startOfMonth(now) } : "skip",
  );
  const cashOut = useMutation(api.platform.profile.cashOut);
  const [sheet, setSheet] = useState(false);
  const [choice, setChoice] = useState(2);
  const [method, setMethod] = useState(0);
  const [sent, setSent] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const focused = useIsFocused();
  const [visits, setVisits] = useState(0);
  useFocusEffect(useCallback(() => () => setVisits((count) => count + 1), []));
  const [coins, setCoins] = useState({ burst: 0, drain: false });
  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));
  const onRoll = (from: number, to: number, changed: boolean) => {
    if (!changed) return;
    setCoins((last) => ({ burst: last.burst + 1, drain: to < from }));
    if (to > from) pop.set(withDelay(520, withSequence(withTiming(1.06, { duration: duration.fast }), withSpring(1, spring.pop))));
  };

  const startCheckout = useAction(api.whop.checkout.start);
  const lastPurchase = useQuery(api.whop.credit.lastPurchase, deviceId && secret ? { deviceId, secret } : "skip");
  const [checkout, setCheckout] = useState<"idle" | "opening" | "waiting">("idle");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [purchaseAtOpen, setPurchaseAtOpen] = useState<number | null>(null);
  const credited = lastPurchase && lastPurchase.createdAt > (purchaseAtOpen ?? now - 120_000) ? lastPurchase : null;

  const getTokens = async () => {
    if (!deviceId || !secret || checkout === "opening") return;
    setCheckoutError(null);
    setCheckout("opening");
    setPurchaseAtOpen(lastPurchase?.createdAt ?? 0);
    const tab = Platform.OS === "web" ? window.open("", "_blank") : null;
    try {
      const url = await startCheckout({
        deviceId,
        secret,
        returnUrl: Platform.OS === "web" ? `${window.location.origin}/wallet` : undefined,
      });
      setCheckout("waiting");
      if (Platform.OS !== "web") await WebBrowser.openBrowserAsync(url);
      else if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (cause) {
      tab?.close();
      setCheckout("idle");
      setCheckoutError(cause instanceof Error && cause.message.includes("not configured") ? "Whop is not configured yet" : "Could not start checkout. Try again.");
    }
  };

  const balance = me?.points ?? 0;
  const amounts = [
    { label: "$25", points: 2500 },
    { label: "$50", points: 5000 },
    { label: "All", points: balance },
  ];
  const amount = sent ?? amounts[choice].points;
  const canConfirm = amount >= MIN_CASH_OUT && amount <= balance && !sending;

  const openSheet = () => {
    setSent(null);
    setError(null);
    setChoice(2);
    setSheet(true);
  };
  const confirm = async () => {
    if (!deviceId || !secret || !canConfirm) return;
    setSending(true);
    setError(null);
    try {
      await cashOut({ deviceId, secret, points: amount });
      setSent(amount);
      haptic("success");
    } catch {
      setError("Couldn't cash out. Try again.");
    } finally {
      setSending(false);
    }
  };

  const spark = activity?.spark ?? [];
  const sparkMax = Math.max(1, ...spark);
  const sparkPoints = spark.map((value, index) => [
    (index / Math.max(1, spark.length - 1)) * 300,
    56 - (value / sparkMax) * 48,
  ]);
  const sparkLine = sparkPoints.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const sparkArea = sparkPoints.length > 1 ? `${sparkLine} L300 60 L0 60 Z` : "";
  const monthName = new Date(now).toLocaleString("en-US", { month: "long" });

  const tokenStatus = credited
    ? `+${formatPoints(credited.tokens)} points added`
    : checkout === "waiting"
      ? "Waiting for payment to confirm…"
      : (checkoutError ?? `+${formatPoints(TOKEN_PACK.tokens)} points instantly`);

  return (
    <SafeAreaView edges={["top"]} style={styles.screen} testID="wallet">
      <TabScene>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TopBar title="Wallet" />

        <View style={styles.hero}>
          <Text style={styles.balanceLabel}>Cash available</Text>
          {me === undefined ? (
            <Skeleton width={190} height={46} radius={14} style={{ marginVertical: 4 }} />
          ) : (
            <Animated.View style={[styles.balancePop, popStyle]}>
              <RollingNumber
                value={me?.balanceCents}
                format={formatCents}
                active={focused && !sheet}
                epoch={visits}
                lineHeight={54}
                style={styles.balance}
                testID="wallet-balance"
                onRoll={onRoll}
              />
            </Animated.View>
          )}
          <CoinFlight burst={coins.burst} drain={coins.drain} style={{ left: 64, top: 62 }} />
          <View style={styles.pointsRow}>
            <View style={styles.pointsPill}>
              <PointsGem size={14} />
              <Text style={styles.pointsText} testID="wallet-points">
                {me ? `${formatPoints(me.points)} pts` : " "}
              </Text>
            </View>
            <Text style={styles.rate}>100 pts = $1</Text>
          </View>

          <View style={styles.actions}>
            <PressableScale style={[styles.action, styles.actionPrimary]} onPress={openSheet} disabled={!me} accessibilityRole="button" testID="wallet-cash-out">
              <Icon d="M12 19V5M5.5 11.5 12 5l6.5 6.5" color={colors.ctaText} size={18} />
              <Text style={[styles.actionText, { color: colors.ctaText }]}>Cash out</Text>
            </PressableScale>
            <PressableScale style={[styles.action, styles.actionSecondary]} onPress={() => router.push("/ranks")} accessibilityRole="link" testID="wallet-boost">
              <Icon d="M3 17l6-6 4 4 8-8M15 7h6v6" color={colors.text} size={18} />
              <Text style={styles.actionText}>Boost</Text>
            </PressableScale>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <IconTile d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6" tint={colors.up} bg="#163533" />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>Earned in {monthName}</Text>
              <Text style={styles.monthValue} testID="wallet-month">
                {formatCents(activity?.monthPoints ?? 0)}
              </Text>
            </View>
          </View>
          <Svg width="100%" height={60} viewBox="0 0 300 60" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="wallet-spark" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.up} stopOpacity={0.35} />
                <Stop offset="1" stopColor={colors.up} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {sparkArea !== "" && <Path d={sparkArea} fill="url(#wallet-spark)" />}
            {sparkPoints.length > 1 ? (
              <Path d={sparkLine} fill="none" stroke={colors.up} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <Path d="M0 56 L300 56" stroke={colors.border} strokeWidth={2} strokeDasharray="4 6" />
            )}
          </Svg>
        </View>

        <View style={[styles.card, styles.list]}>
          <PressableScale
            scale={0.98}
            style={[styles.listRow, checkout === "opening" && { opacity: 0.6 }]}
            onPress={getTokens}
            disabled={!deviceId || !secret || checkout === "opening"}
            accessibilityRole="button"
            testID="wallet-get-tokens"
          >
            <View style={[styles.tile, { backgroundColor: "#2A2547" }]}>
              <PointsGem size={20} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rowTitle}>{formatPoints(TOKEN_PACK.tokens)} token pack</Text>
              <Text
                style={[styles.rowDetail, credited && { color: colors.up }, !credited && checkoutError !== null && { color: colors.down }]}
                numberOfLines={1}
                testID="wallet-purchase-status"
              >
                {tokenStatus}
              </Text>
            </View>
            <View style={styles.price}>
              <Text style={styles.priceText}>{checkout === "opening" ? "Opening…" : `$${TOKEN_PACK.priceUsd.toFixed(2)}`}</Text>
            </View>
          </PressableScale>
          <View style={styles.listDivider} />
          <PressableScale style={styles.listRow} scale={0.98} onPress={() => router.push("/earnings")} accessibilityRole="link" testID="wallet-open-earnings">
            <IconTile d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" tint="#FFD2B0" bg="#3A2B2A" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rowTitle}>Cash out with Whop</Text>
              <Text style={styles.rowDetail} numberOfLines={1}>
                Send USD to your Whop balance
              </Text>
            </View>
            <Icon d="M9 6l6 6-6 6" color={colors.muted} size={18} />
          </PressableScale>
        </View>

        <View style={styles.activity}>
          <Text style={styles.sectionTitle}>Activity</Text>
          {activity && activity.entries.length === 0 && (
            <View style={styles.empty}>
              <IconTile d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" tint={colors.muted} bg={colors.surface} />
              <Text style={styles.emptyText}>Points you earn show up here.</Text>
            </View>
          )}
          {!activity &&
            Array.from({ length: 4 }, (_, index) => (
              <View key={index} style={styles.entry}>
                <Skeleton height={42} radius={13} />
              </View>
            ))}
          {activity?.entries.slice(0, 8).map((entry, index) => {
            const game = entry.game === "unpredictable" || entry.game === "jailbreak";
            const art = GAMES.find((g) => g.key === entry.game)?.image;
            const detail = game
              ? `${entry.rounds} ${entry.game === "unpredictable" ? "round" : "hit"}${entry.rounds === 1 ? "" : "s"}`
              : entry.game === "cashout"
                ? "Demo transfer"
                : entry.game === "purchase"
                  ? "Whop checkout"
                  : entry.note;
            const icon = ENTRY_ICONS[entry.game] ?? ENTRY_ICONS.default;
            return (
              <Enter key={entry.at} index={index} style={styles.entry} testID="wallet-activity">
                {art ? <Image source={art} style={styles.entryArt} /> : <IconTile d={icon.d} tint={icon.tint} bg={icon.bg} />}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {GAME_TITLES[entry.game] ?? entry.game}
                  </Text>
                  <Text style={styles.rowDetail} numberOfLines={1}>
                    {dayLabel(entry.at, now)} · {detail}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 3 }}>
                  <Text style={[styles.entryAmount, entry.points > 0 && { color: colors.up }]}>
                    {entry.points < 0 ? "−" : "+"}
                    {formatCents(Math.abs(entry.points))}
                  </Text>
                  {game && entry.multiplier > 1 ? (
                    <View style={styles.boost}>
                      <Text style={styles.boostText}>{entry.multiplier}x</Text>
                    </View>
                  ) : (
                    <Text style={styles.entryPoints}>{formatPoints(Math.abs(entry.points))} pts</Text>
                  )}
                </View>
              </Enter>
            );
          })}
        </View>
      </ScrollView>
      </TabScene>

      <Sheet visible={sheet} onClose={() => setSheet(false)} label="Cash out">
        {sent === null ? (
          <View style={{ gap: 16 }}>
            <Text style={styles.sheetTitle}>Cash out</Text>
            <View style={styles.amountBlock}>
              <Text style={styles.amount} testID="cashout-amount">{formatCents(amount)}</Text>
              <Text style={styles.amountPoints}>{formatPoints(amount)} pts</Text>
            </View>
            <View style={styles.amounts}>
              {amounts.map((option, index) => {
                const on = index === choice;
                const disabled = option.points > balance;
                return (
                  <PressableScale
                    key={option.label}
                    onPress={() => setChoice(index)}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on, disabled }}
                    style={[styles.amountChip, on && styles.amountChipOn, disabled && { opacity: 0.35 }]}
                    testID={`cashout-amount-${index}`}
                  >
                    <Text style={[styles.amountChipText, on && { color: colors.ctaText }]}>{option.label}</Text>
                  </PressableScale>
                );
              })}
            </View>
            <View style={{ gap: 8 }}>
              <Text style={styles.sendTo}>Send to</Text>
              {METHODS.map((option, index) => {
                const on = index === method;
                return (
                  <PressableScale
                    key={option.name}
                    onPress={() => setMethod(index)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    scale={0.98}
                    style={[styles.method, on && styles.methodOn]}
                    testID={`cashout-method-${index}`}
                  >
                    <View style={{ gap: 2 }}>
                      <Text style={styles.methodName}>{option.name}</Text>
                      <Text style={styles.methodDetail}>{option.detail}</Text>
                    </View>
                    <View style={on ? styles.dotOn : styles.dot} />
                  </PressableScale>
                );
              })}
            </View>
            {(error || balance < MIN_CASH_OUT) && (
              <Text style={styles.error} testID="cashout-error">
                {error ?? "You need at least $1.00 to cash out."}
              </Text>
            )}
            <PressableScale
              style={[styles.confirm, !canConfirm && { opacity: 0.4 }]}
              onPress={confirm}
              disabled={!canConfirm}
              accessibilityRole="button"
              testID="cashout-confirm"
            >
              <Text style={styles.confirmText}>Confirm {formatCents(amount)}</Text>
            </PressableScale>
            <Text style={styles.demo}>Demo cash-out. No real money moves.</Text>
          </View>
        ) : (
          <View style={styles.doneBlock} testID="cashout-done">
            <Animated.View entering={ZoomIn.springify().damping(11).stiffness(220)} style={styles.check}>
              <Svg width={38} height={38} viewBox="0 0 24 24" fill="none" stroke={colors.up} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M5 12.5l4.5 4.5L19 7.5" />
              </Svg>
            </Animated.View>
            <Text style={styles.doneTitle}>{formatCents(sent)} is on its way</Text>
            <Text style={styles.doneDetail}>Sent to {METHODS[method].name.toLowerCase()}. Demo only, so nothing arrives.</Text>
            <PressableScale style={styles.doneButton} onPress={() => setSheet(false)} accessibilityRole="button" testID="cashout-close">
              <Text style={styles.actionText}>Done</Text>
            </PressableScale>
          </View>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 4, paddingBottom: 36 },
  hero: {
    marginTop: 10,
    marginHorizontal: 20,
    padding: 20,
    gap: 4,
    zIndex: 2,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#2E2B4D",
    backgroundColor: colors.surface,
    backgroundImage: "linear-gradient(150deg, #2B2450 0%, #1A1830 55%, #15151F 100%)",
  },
  balancePop: { alignSelf: "flex-start", transformOrigin: "left center" },
  balanceLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.tertiary },
  balance: {
    fontFamily: fonts.headingMedium,
    fontSize: 50,
    lineHeight: 54,
    letterSpacing: -1.6,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  pointsRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  pointsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingLeft: 8,
    paddingRight: 11,
    borderRadius: 999,
    backgroundColor: "rgba(11,11,20,0.5)",
  },
  pointsText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text, fontVariant: ["tabular-nums"] },
  rate: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  action: { flex: 1, height: 50, borderRadius: 999, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  actionPrimary: { backgroundImage: `linear-gradient(100deg, ${ctaGradient[0]} 0%, ${ctaGradient[1]} 55%, ${ctaGradient[2]} 100%)` },
  actionSecondary: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  actionText: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  card: {
    marginTop: 12,
    marginHorizontal: 20,
    padding: 16,
    gap: 14,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.tertiary },
  monthValue: { fontFamily: fonts.headingMedium, fontSize: 22, color: colors.text, fontVariant: ["tabular-nums"] },
  tile: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  list: { paddingVertical: 4, gap: 0 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 10, borderRadius: 14 },
  listDivider: { height: 1, marginLeft: 54, backgroundColor: colors.divider },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  rowDetail: { fontFamily: fonts.body, fontSize: 13, color: colors.tertiary },
  price: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, backgroundColor: colors.accent },
  priceText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ctaText, fontVariant: ["tabular-nums"] },
  activity: { paddingTop: 26, paddingHorizontal: 20 },
  sectionTitle: { fontFamily: fonts.headingMedium, fontSize: 19, color: colors.text, marginBottom: 6 },
  empty: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: colors.tertiary },
  entry: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  entryArt: { width: 42, height: 42, borderRadius: 13 },
  entryAmount: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, fontVariant: ["tabular-nums"] },
  entryPoints: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  boost: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999, backgroundColor: "#26244A" },
  boostText: { fontFamily: fonts.bold, fontSize: 11, color: colors.accent },
  sheetTitle: { fontFamily: fonts.headingMedium, fontSize: 22, color: colors.text },
  amountBlock: { alignItems: "center", gap: 2, paddingVertical: 6 },
  amount: { fontFamily: fonts.headingMedium, fontSize: 54, letterSpacing: -1.6, color: colors.text, fontVariant: ["tabular-nums"] },
  amountPoints: { fontFamily: fonts.body, fontSize: 13.5, color: colors.tertiary },
  amounts: { flexDirection: "row", gap: 8 },
  amountChip: { flex: 1, height: 46, borderRadius: 999, borderWidth: 1.5, borderColor: "#34324A", alignItems: "center", justifyContent: "center" },
  amountChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  amountChipText: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  sendTo: { fontFamily: fonts.semibold, fontSize: 13, color: colors.tertiary },
  method: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#0F0F18",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  methodOn: { backgroundColor: "#1F1E33", borderColor: colors.periwinkle },
  methodName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  methodDetail: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tertiary },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#4A4766" },
  dotOn: { width: 20, height: 20, borderRadius: 10, borderWidth: 6, borderColor: colors.periwinkle, backgroundColor: colors.text },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.down, textAlign: "center" },
  confirm: { height: 54, borderRadius: 999, backgroundColor: colors.text, alignItems: "center", justifyContent: "center" },
  confirmText: { fontFamily: fonts.bold, fontSize: 16, color: colors.ctaText },
  demo: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, textAlign: "center", marginTop: -6 },
  doneBlock: { alignItems: "center", gap: 10, paddingTop: 18, paddingBottom: 4 },
  check: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#173A38", alignItems: "center", justifyContent: "center" },
  doneTitle: { fontFamily: fonts.headingMedium, fontSize: 24, color: colors.text, textAlign: "center" },
  doneDetail: { fontFamily: fonts.body, fontSize: 14.5, color: colors.secondary, textAlign: "center" },
  doneButton: { marginTop: 8, alignSelf: "stretch", height: 52, borderRadius: 999, backgroundColor: "#1F1E30", alignItems: "center", justifyContent: "center" },
});
