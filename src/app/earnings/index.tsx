import { useAction, useMutation, useQuery } from "convex/react";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Enter, PressableScale, RollingNumber } from "@/motion";
import { Sheet } from "@/platform/Sheet";
import { api } from "../../../convex/_generated/api";
import { useWalletCredentials } from "@/cashout/credentials";
import { colors, errorMessage, formatCredits, formatUsd, rateLabel } from "@/cashout/format";

const DEMO_LABEL = "Demo payout: no real money moves";

type Earnings = NonNullable<(typeof api.cashout.wallet.earnings)["_returnType"]>;
type Redemption = Earnings["history"][number];

function statusCopy(r: Redemption) {
  const to = r.whopUsername ? `@${r.whopUsername}'s` : "your";
  if (r.status === "pending") return { label: "Pending", color: colors.secondary, detail: "Credits reserved. Sending to Whop." };
  if (r.status === "processing" && r.needsReview)
    return {
      label: "Delayed",
      color: colors.warning,
      detail: "Whop hasn't confirmed this transfer yet. Your credits stay reserved and you can't be paid twice. Ako is checking.",
    };
  if (r.status === "processing") return { label: "Processing at Whop", color: colors.secondary, detail: "Whop is settling the transfer." };
  if (r.status === "transferred")
    return {
      label: "Transferred to Whop",
      color: colors.up,
      detail: `In ${to} Whop balance. It is not in your bank yet: withdraw from Whop to move it there.`,
    };
  return { label: "Failed · credits returned", color: colors.down, detail: r.failureReason ?? "The transfer did not go through." };
}

export default function EarningsScreen() {
  const credentials = useWalletCredentials();
  const data = useQuery(api.cashout.wallet.earnings, credentials ?? "skip");
  const claim = useMutation(api.cashout.wallet.claimWallet);
  const startLink = useMutation(api.cashout.wallet.startWhopLink);
  const requestCashOut = useMutation(api.cashout.wallet.requestCashOut);
  const linkAccount = useAction(api.cashout.whop.linkWhopAccount);
  const [username, setUsername] = useState("");

  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [linking, setLinking] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (credentials && data === null) claim(credentials).catch((e) => setNotice({ tone: "bad", text: errorMessage(e) }));
  }, [credentials, data, claim]);

  async function connectWhop() {
    if (!credentials) return;
    setLinking(true);
    setNotice(null);
    try {
      const returnUrl = Linking.createURL("earnings");
      const url = await startLink({ ...credentials, returnUrl });
      const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
      if (result.type === "success") {
        const { queryParams } = Linking.parse(result.url);
        if (queryParams?.whop === "linked") setNotice({ tone: "good", text: "Whop account connected." });
        else setNotice({ tone: "bad", text: String(queryParams?.message ?? "Whop sign-in failed.") });
      }
    } catch (e) {
      setNotice({ tone: "bad", text: errorMessage(e) });
    } finally {
      setLinking(false);
    }
  }

  async function linkByUsername() {
    if (!credentials || linking) return;
    setLinking(true);
    setNotice(null);
    try {
      const linked = await linkAccount({ ...credentials, username });
      setNotice({ tone: "good", text: `Linked @${linked.username}${linked.name ? ` (${linked.name})` : ""}.` });
    } catch (e) {
      setNotice({ tone: "bad", text: errorMessage(e) });
    } finally {
      setLinking(false);
    }
  }

  function openConfirm() {
    setConfirmError(null);
    setRequestId(Crypto.randomUUID());
  }

  async function confirmCashOut() {
    if (!credentials || !requestId || submitting) return;
    setSubmitting(true);
    setConfirmError(null);
    try {
      await requestCashOut({ ...credentials, requestId });
      setRequestId(null);
      setNotice({ tone: "good", text: "Cash-out submitted. Track it under History." });
    } catch (e) {
      setConfirmError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (!data) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Stack.Screen options={headerOptions} />
        <ActivityIndicator color={colors.violet} />
      </View>
    );
  }

  const { rules } = data;
  const belowMinimum = data.cashOutNetCents < rules.minimumCents;
  const blocker =
    data.mode === "disabled"
      ? data.disabledReason
      : !data.whop
        ? "Connect Whop to cash out."
        : data.inFlight
          ? "Your last cash-out is still processing."
          : belowMinimum
            ? `Minimum cash-out is ${formatUsd(rules.minimumCents)} (${formatCredits(rules.minimumCents / rules.centsPerCredit)}).`
            : null;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={headerOptions} />
      <ScrollView contentContainerStyle={styles.content}>
        {data.mode === "demo" && (
          <Text style={[styles.banner, { color: colors.warning, borderColor: colors.warning }]} testID="demo-label">
            {DEMO_LABEL}
          </Text>
        )}
        {data.mode === "sandbox" && (
          <Text style={[styles.banner, { color: colors.warning, borderColor: colors.warning }]}>
            Test mode: transfers use Whop&apos;s sandbox. No real money moves.
          </Text>
        )}
        {notice && (
          <Text style={[styles.banner, { color: notice.tone === "good" ? colors.up : colors.down, borderColor: colors.border }]}>
            {notice.text}
          </Text>
        )}

        <View style={styles.card}>
          <Text style={styles.label}>Cash value available</Text>
          <RollingNumber value={data.availableCents} format={formatUsd} lineHeight={52} style={styles.big} testID="available-cash" />
          <Text style={styles.secondary}>
            {formatCredits(data.availableCredits)} · {rateLabel(rules.centsPerCredit)}
          </Text>
          <PressableScale
            testID="cash-out"
            accessibilityRole="button"
            disabled={blocker !== null}
            onPress={openConfirm}
            style={[styles.cta, blocker !== null && styles.ctaDisabled]}
          >
            <Text style={styles.ctaText}>Cash out {formatUsd(data.cashOutNetCents)}</Text>
          </PressableScale>
          {blocker && <Text style={styles.hint}>{blocker}</Text>}
        </View>

        <View style={styles.statsRow}>
          <Stat label="Earned credits" value={data.earnedCredits.toLocaleString("en-US")} />
          <Stat label="Pending credits" value={data.pendingCredits.toLocaleString("en-US")} />
          <Stat label="Sent to Whop" value={formatUsd(data.transferredCents)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Whop account</Text>
          {data.whop ? (
            <Text style={styles.secondary}>
              Connected to {data.whop.username ? `@${data.whop.username}` : data.whop.userId}. Cash-outs go to this Whop
              balance.
            </Text>
          ) : (
            <>
              <Text style={styles.secondary}>
                Ako pays cash-outs into your Whop balance. Connect the Whop account you want paid.
              </Text>
              {data.linkMode === "username" && (
                <TextInput
                  testID="whop-username"
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Your Whop username"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
              )}
              <PressableScale
                testID="connect-whop"
                accessibilityRole="button"
                disabled={data.linkMode === null || linking || (data.linkMode === "username" && !username.trim())}
                onPress={data.linkMode === "oauth" ? connectWhop : linkByUsername}
                style={[
                  styles.secondaryButton,
                  (data.linkMode === null || linking || (data.linkMode === "username" && !username.trim())) &&
                    styles.ctaDisabled,
                ]}
              >
                <Text style={styles.secondaryButtonText}>{linking ? "Connecting…" : "Connect Whop"}</Text>
              </PressableScale>
              {data.linkMode === "username" && (
                <Text style={styles.hint}>Double-check the username: cash-outs are paid to that Whop account.</Text>
              )}
              {data.linkMode === null && <Text style={styles.hint}>Connecting Whop isn&apos;t set up yet.</Text>}
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>History</Text>
        {data.history.length === 0 && <Text style={styles.muted}>No cash-outs yet.</Text>}
        {data.history.map((r, index) => {
          const copy = statusCopy(r);
          const demo = r.whopTransferId?.startsWith("demo_") ?? false;
          return (
            <Enter key={r._id} index={index} style={styles.row} testID="cash-out-row">
              <View style={styles.rowHead}>
                <Text style={styles.rowAmount}>{formatUsd(r.netCents)}</Text>
                <Text style={[styles.status, { color: copy.color }]}>{demo ? `${copy.label} (demo)` : copy.label}</Text>
              </View>
              <Text style={styles.muted}>
                {new Date(r.requestedAt).toLocaleString()} · {formatCredits(r.credits)}
                {r.environment === "sandbox" ? " · sandbox" : ""}
              </Text>
              {demo ? (
                <>
                  <Text style={[styles.secondary, { color: colors.warning }]}>{DEMO_LABEL}</Text>
                  <Text style={styles.muted} selectable>
                    Transfer {r.whopTransferId}
                  </Text>
                </>
              ) : (
                <Text style={styles.secondary}>{copy.detail}</Text>
              )}
              {r.status === "transferred" && !demo && (
                <View style={styles.links}>
                  {r.trackingUrl && (
                    <Text style={styles.link} onPress={() => WebBrowser.openBrowserAsync(r.trackingUrl!)}>
                      View transfer
                    </Text>
                  )}
                  <Text style={styles.link} onPress={() => WebBrowser.openBrowserAsync(data.whopWebBase)}>
                    Withdraw in Whop
                  </Text>
                </View>
              )}
            </Enter>
          );
        })}

        <Text style={styles.sectionTitle}>Recent credits</Text>
        {data.recentRewards.length === 0 && <Text style={styles.muted}>Win a round to earn credits.</Text>}
        {data.recentRewards.map((reward) => (
          <View key={reward._id} style={styles.rewardRow}>
            <Text style={styles.secondary} numberOfLines={1}>
              {reward.note}
            </Text>
            <Text style={styles.rewardCredits}>+{reward.credits}</Text>
          </View>
        ))}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How cash-out works</Text>
          <Text style={styles.secondary}>
            Credits come only from wins Ako&apos;s server verifies: defeating the standard Jailbreak Boss and finishing an
            Unpredictable run. Game points and rank rating are separate and never convert to money. Up to{" "}
            {formatCredits(rules.dailyCreditCap)} can be earned per day.
          </Text>
          <Text style={styles.secondary}>
            Cash-out sends US dollars from Ako to your Whop balance. To get it into your bank, open Whop, go to your
            balance and choose Withdraw. Whop&apos;s payout fees and timing apply there.
          </Text>
        </View>
      </ScrollView>

      <Sheet visible={requestId !== null} onClose={() => setRequestId(null)} label="Confirm cash-out">
        <View>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Confirm cash-out</Text>
            <Line label="Credits" value={formatCredits(data.availableCredits)} />
            <Line label="Rate" value={rateLabel(rules.centsPerCredit)} />
            <Line label="Cash value" value={formatUsd(data.availableCents)} />
            <Line label="Ako fee" value={formatUsd(rules.feeCents)} />
            <Line label="Minimum" value={formatUsd(rules.minimumCents)} />
            <Line label="You receive" value={formatUsd(data.cashOutNetCents)} strong />
            <Line
              label="Paid to"
              value={`Whop balance${data.whop?.username ? ` (@${data.whop.username})` : ""}`}
            />
            <Text style={styles.hint}>
              This moves money to your Whop balance, not your bank. Withdraw from Whop to send it to your bank.
              {data.mode === "sandbox" ? " Test mode: sandbox money only." : ""}
            </Text>
            {data.mode === "demo" && <Text style={[styles.hint, { color: colors.warning }]}>{DEMO_LABEL}</Text>}
            {confirmError && <Text style={[styles.hint, { color: colors.down }]}>{confirmError}</Text>}
            <PressableScale
              testID="confirm-cash-out"
              accessibilityRole="button"
              disabled={submitting}
              onPress={confirmCashOut}
              style={[styles.cta, submitting && styles.ctaDisabled]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.ctaText} />
              ) : (
                <Text style={styles.ctaText}>Confirm {formatUsd(data.cashOutNetCents)}</Text>
              )}
            </PressableScale>
            <PressableScale accessibilityRole="button" onPress={() => setRequestId(null)} style={styles.cancel}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </PressableScale>
          </View>
        </View>
      </Sheet>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={strong ? styles.lineStrong : styles.lineValue}>{value}</Text>
    </View>
  );
}

const headerOptions = {
  headerShown: true,
  title: "Earnings",
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerShadowVisible: false,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  content: { padding: 20, gap: 14, paddingBottom: 48 },
  banner: { borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 13 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 22, padding: 18, gap: 10 },
  label: { color: colors.muted, fontSize: 13 },
  big: { color: colors.text, fontSize: 44, fontWeight: "700" },
  secondary: { color: colors.secondary, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.muted, fontSize: 12 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  cta: { backgroundColor: colors.violet, borderRadius: 999, minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 4 },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { color: colors.ctaText, fontSize: 16, fontWeight: "700" },
  input: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 44,
    color: colors.text,
    backgroundColor: colors.raised,
  },
  secondaryButton: { borderColor: colors.violet, borderWidth: 1, borderRadius: 999, minHeight: 44, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, backgroundColor: colors.raised, borderRadius: 18, padding: 12, gap: 4 },
  statValue: { color: colors.text, fontSize: 18, fontWeight: "700" },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "700", marginTop: 6 },
  row: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 14, gap: 6 },
  rowHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowAmount: { color: colors.text, fontSize: 18, fontWeight: "700" },
  status: { fontSize: 13, fontWeight: "700" },
  links: { flexDirection: "row", gap: 18, marginTop: 2 },
  link: { color: colors.violet, fontSize: 14, fontWeight: "600", paddingVertical: 6 },
  rewardRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rewardCredits: { color: colors.up, fontSize: 14, fontWeight: "700" },
  sheet: { gap: 10 },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: "700", marginBottom: 4 },
  line: { flexDirection: "row", justifyContent: "space-between" },
  lineValue: { color: colors.secondary, fontSize: 14 },
  lineStrong: { color: colors.text, fontSize: 16, fontWeight: "700" },
  cancel: { alignItems: "center", justifyContent: "center", minHeight: 44 },
});
