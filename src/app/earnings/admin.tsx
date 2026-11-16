import { useConvex } from "convex/react";
import { Stack } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { colors, errorMessage, formatUsd } from "@/cashout/format";

type Report = (typeof api.cashout.admin.report)["_returnType"];

export default function CashOutAdmin() {
  const convex = useConvex();
  const [adminKey, setAdminKey] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setReport(await convex.query(api.cashout.admin.report, { adminKey }));
    } catch (e) {
      setReport(null);
      setError(errorMessage(e));
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: true, title: "Cash-out admin", headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }} />
      <TextInput
        value={adminKey}
        onChangeText={setAdminKey}
        placeholder="Admin key"
        placeholderTextColor={colors.muted}
        secureTextEntry
        autoCapitalize="none"
        style={styles.input}
      />
      <Pressable accessibilityRole="button" onPress={load} style={styles.button}>
        <Text style={styles.buttonText}>{report ? "Refresh" : "Load report"}</Text>
      </Pressable>
      {error && <Text style={{ color: colors.down }}>{error}</Text>}
      {report && (
        <>
          <Text style={styles.text}>
            Pending {report.counts.pending} · Processing {report.counts.processing} · Transferred{" "}
            {report.counts.transferred} · Failed {report.counts.failed} · Needs review {report.needsReview}
          </Text>
          {report.redemptions.map((r) => (
            <View key={r._id} style={styles.row}>
              <Text style={styles.text}>
                {formatUsd(r.netCents)} · {r.status}
                {r.needsReview ? " · NEEDS REVIEW" : ""} · {r.environment}
              </Text>
              <Text style={styles.muted}>Whop transfer: {r.whopTransferId ?? "none"} ({r.whopStatus ?? "not sent"})</Text>
              <Text style={styles.muted}>
                To {r.whopUsername ? `@${r.whopUsername} ` : ""}
                {r.whopUserId} · {r.credits} credits · {r.attempts} attempts
              </Text>
              {r.failureReason && <Text style={{ color: colors.down, fontSize: 12 }}>{r.failureReason}</Text>}
              <Text style={styles.muted}>{new Date(r.requestedAt).toLocaleString()} · {r._id}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 12 },
  input: { borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 12, color: colors.text, backgroundColor: colors.surface },
  button: { backgroundColor: colors.violet, borderRadius: 999, minHeight: 44, alignItems: "center", justifyContent: "center" },
  buttonText: { color: colors.ctaText, fontWeight: "700" },
  text: { color: colors.text, fontSize: 14 },
  muted: { color: colors.muted, fontSize: 12 },
  row: { backgroundColor: colors.surface, borderRadius: 16, padding: 12, gap: 4 },
});
