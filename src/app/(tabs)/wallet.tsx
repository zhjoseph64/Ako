import { useAction, useMutation, useQuery } from "convex/react";
import { router, useFocusEffect, useIsFocused } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming, ZoomIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { CoinFlight, duration, Enter, haptic, PressableScale, RollingNumber, Skeleton, spring, TabScene } from "@/motion";
import { Sheet } from "@/platform/Sheet";
import { colors, ctaGradient, fonts, formatCents, formatPoints } from "@/platform/theme";
import { TopBar } from "@/platform/ui";
import { useMe } from "@/platform/useMe";
import { dayLabel, GAME_TITLES, startOfDay, startOfMonth } from "@/platform/when";
import { api } from "../../../convex/_generated/api";
import { TOKEN_PACK } from "../../../convex/whop/pack";

const MIN_CASH_OUT = 100;
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
  const onRoll = (from: number, to: number) => {
    if (from === 0) return;
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
  const sparkPath = spark
    .map((value, index) => `${index === 0 ? "M" : "L"}${((index / Math.max(1, spark.length - 1)) * 120).toFixed(1)} ${(36 - (value / sparkMax) * 32).toFixed(1)}`)
    .join(" ");

  return (
    <SafeAreaView edges={["top"]} style={styles.screen} testID="wallet">
      <TabScene>
      <ScrollView contentContainerStyle={styles.content}>
        <TopBar title="Wallet" />

        <View style={styles.balanceBlock}>
          <Text style={styles.balanceLabel}>Cash available</Text>
          {me === undefined ? (
            <Skeleton width={190} height={46} radius={14} style={{ marginVertical: 3 }} />
          ) : (
            <Animated.View style={[styles.balancePop, popStyle]}>
              <RollingNumber
                value={me?.balanceCents}
                format={formatCents}
                active={focused && !sheet}
                epoch={visits}
                lineHeight={52.5}
                style={styles.balance}
                testID="wallet-balance"
                onRoll={onRoll}
              />
            </Animated.View>
          )}
          <CoinFlight burst={coins.burst} drain={coins.drain} style={{ left: 64, top: 62 }} />
          <Text style={styles.balanceNote} testID="wallet-points">
            {me ? `${formatPoints(me.points)} pts · 100 pts = $1` : " "}
          </Text>
        </View>

        <View style={styles.actions}>
          <PressableScale style={styles.action} onPress={openSheet} disabled={!me} accessibilityRole="button" testID="wallet-cash-out">
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
              <Defs>
                <LinearGradient id="wallet-cta" x1="0" y1="0" x2="1" y2="0.2">
                  <Stop offset="0" stopColor={ctaGradient[0]} />
                  <Stop offset="0.55" stopColor={ctaGradient[1]} />
                  <Stop offset="1" stopColor={ctaGradient[2]} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#wallet-cta)" />
            </Svg>
            <Text style={[styles.actionText, { color: colors.ctaText }]}>Cash out</Text>
          </PressableScale>
          <PressableScale
            style={[styles.action, { backgroundColor: colors.raised }]}
            onPress={() => router.push("/ranks")}
            accessibilityRole="link"
            testID="wallet-boost"
          >
            <Text style={styles.actionText}>Boost earnings</Text>
          </PressableScale>
        </View>

        <View style={styles.today}>
          <View style={styles.todayIcon}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx="12" cy="12" r="9" />
              <Path d="M12 7v5l3 2" />
            </Svg>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.todayTitle} testID="wallet-today">
              {formatPoints(activity?.dayPoints ?? 0)} pts earned today
            </Text>
            <Text style={styles.todayDetail}>
              {me ? `Paid at your ${me.tierLabel} ${me.multiplier}x rank multiplier. Ready to cash out.` : " "}
            </Text>
          </View>
          <Text style={styles.todayCash}>{formatCents(activity?.dayPoints ?? 0)}</Text>
        </View>

        <View style={styles.month}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.monthLabel}>Earned in {new Date(now).toLocaleString("en-US", { month: "long" })}</Text>
            <Text style={styles.monthValue} testID="wallet-month">
              {formatCents(activity?.monthPoints ?? 0)}
            </Text>
          </View>
          <Svg width={120} height={40} viewBox="0 0 120 40">
            {spark.length > 1 && <Path d={sparkPath} fill="none" stroke={colors.up} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
          </Svg>
        </View>

        <View style={styles.month}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.todayTitle}>{formatPoints(TOKEN_PACK.tokens)} token pack</Text>
            <Text
              style={[styles.todayDetail, credited && { color: colors.up }, !credited && checkoutError !== null && { color: colors.down }]}
              testID="wallet-purchase-status"
            >
              {credited
                ? `+${formatPoints(credited.tokens)} points added`
                : checkout === "waiting"
                  ? "Waiting for your payment to confirm…"
                  : (checkoutError ?? `$${TOKEN_PACK.priceUsd.toFixed(2)} · adds ${formatPoints(TOKEN_PACK.tokens)} points · checkout by Whop`)}
            </Text>
          </View>
          <PressableScale
            style={[styles.slotButton, { backgroundColor: colors.accent }, checkout === "opening" && { opacity: 0.7 }]}
            onPress={getTokens}
            disabled={!deviceId || !secret || checkout === "opening"}
            accessibilityRole="button"
            testID="wallet-get-tokens"
          >
            <Text style={[styles.slotButtonText, { color: colors.ctaText }]}>{checkout === "opening" ? "Opening…" : "Get tokens"}</Text>
          </PressableScale>
        </View>

        <View style={styles.month}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.todayTitle}>Cash out with Whop</Text>
            <Text style={styles.todayDetail}>Turn verified game credits into USD in your Whop balance.</Text>
          </View>
          <PressableScale
            style={[styles.slotButton, { backgroundColor: colors.raised }]}
            onPress={() => router.push("/earnings")}
            accessibilityRole="link"
            testID="wallet-open-earnings"
          >
            <Text style={styles.slotButtonText}>Open Earnings</Text>
          </PressableScale>
        </View>

        <View style={styles.activity}>
          <Text style={styles.sectionTitle}>Activity</Text>
          {activity && activity.entries.length === 0 && <Text style={styles.empty}>Points you earn show up here.</Text>}
          {!activity &&
            Array.from({ length: 4 }, (_, index) => (
              <View key={index} style={styles.entry}>
                <Skeleton height={38} radius={12} />
              </View>
            ))}
          {activity?.entries.slice(0, 8).map((entry, index) => {
            const game = entry.game === "unpredictable" || entry.game === "jailbreak";
            const detail = game
              ? `${entry.rounds} ${entry.game === "unpredictable" ? "round" : "hit"}${entry.rounds === 1 ? "" : "s"} · ${entry.multiplier}x rank bonus`
              : entry.game === "cashout"
                ? "demo transfer"
                : entry.game === "purchase"
                  ? "Whop checkout"
                  : entry.note;
            return (
              <Enter key={entry.at} index={index} style={styles.entry} testID="wallet-activity">
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.entryTitle}>{GAME_TITLES[entry.game] ?? entry.game}</Text>
                  <Text style={styles.entryDetail} numberOfLines={1}>
                    {dayLabel(entry.at, now)} · {detail}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text style={[styles.entryAmount, entry.points > 0 && { color: colors.up }]}>
                    {entry.points < 0 ? "−" : "+"}
                    {formatCents(Math.abs(entry.points))}
                  </Text>
                  <Text style={styles.entryPoints}>{formatPoints(Math.abs(entry.points))} pts</Text>
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
  balanceBlock: { paddingTop: 18, paddingHorizontal: 20, gap: 4 },
  balanceLabel: { fontFamily: fonts.medium, fontSize: 15, color: colors.tertiary },
  balance: {
    fontFamily: fonts.headingMedium,
    fontSize: 50,
    lineHeight: 52.5,
    letterSpacing: -1.6,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  balancePop: { alignSelf: "flex-start", transformOrigin: "left center" },
  balanceNote: { fontFamily: fonts.body, fontSize: 14.5, color: colors.tertiary },
  actions: { flexDirection: "row", gap: 10, paddingTop: 20, paddingHorizontal: 20 },
  action: { flex: 1, height: 52, borderRadius: 999, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  actionText: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  today: {
    marginTop: 22,
    marginHorizontal: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  todayIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#22213A", alignItems: "center", justifyContent: "center" },
  todayTitle: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  todayDetail: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tertiary },
  todayCash: { fontFamily: fonts.semibold, fontSize: 14, color: colors.tertiary },
  month: {
    marginTop: 12,
    marginHorizontal: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  monthLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.tertiary },
  monthValue: { fontFamily: fonts.headingMedium, fontSize: 22, color: colors.text },
  slotButton: { height: 44, paddingHorizontal: 16, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  slotButtonText: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  activity: { paddingTop: 24, paddingHorizontal: 20 },
  sectionTitle: { fontFamily: fonts.headingMedium, fontSize: 19, color: colors.text, marginBottom: 4 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.tertiary, paddingVertical: 12 },
  entry: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.divider },
  entryTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  entryDetail: { fontFamily: fonts.body, fontSize: 13, color: colors.tertiary },
  entryAmount: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, fontVariant: ["tabular-nums"] },
  entryPoints: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
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
