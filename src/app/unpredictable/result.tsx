import { useQuery } from "convex/react";
import { Link } from "expo-router";
import * as Sharing from "expo-sharing";
import { ComponentRef, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import { useDeviceId } from "@/unpredictable/device";
import { colors } from "@/unpredictable/theme";

import { api } from "../../../convex/_generated/api";

const MARK = { predicted: "🎯", escaped: "🌀", void: "➖" };

export default function Result() {
  const deviceId = useDeviceId();
  const summary = useQuery(api.unpredictable.game.summary, deviceId ? { deviceId } : "skip");
  const card = useRef<ComponentRef<typeof View>>(null);

  if (!summary) return <SafeAreaView style={styles.screen} />;

  const share = async () => {
    const uri = await captureRef(card, { format: "png", quality: 1 });
    await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png" });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View ref={card} collapsable={false} style={styles.card} testID="share-card">
          <Text style={styles.cardKicker}>UNPREDICTABLE · {summary.day}</Text>
          <Text style={styles.cardLine}>The AI predicted me</Text>
          <Text style={styles.cardScore} testID="score">
            {summary.predicted}/{summary.total}
          </Text>
          <Text style={styles.cardLine}>today</Text>
          <View style={styles.marks}>
            {summary.rounds.map((r) => (
              <Text key={r.index} style={styles.mark}>
                {r.outcome ? MARK[r.outcome] : "·"}
              </Text>
            ))}
          </View>
          <Text style={styles.cardFoot}>
            {summary.name} · {summary.points} pts
            {summary.bonus > 0 ? ` · ${summary.bonus} crowd bonus` : ""}
          </Text>
        </View>

        <Pressable style={styles.button} onPress={share} testID="share-button">
          <Text style={styles.buttonText}>Share card</Text>
        </Pressable>

        <View style={styles.list}>
          {summary.rounds.map((r) => (
            <View key={r.index} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowPrompt}>{r.prompt}</Text>
                <Text style={styles.rowAnswer}>{r.answer || "No answer"}</Text>
              </View>
              <View style={styles.rowRight}>
                <Text
                  style={[
                    styles.rowOutcome,
                    r.outcome === "escaped" && { color: colors.win },
                    r.outcome === "predicted" && { color: colors.lose },
                    r.outcome === "void" && { color: colors.void },
                  ]}
                >
                  {r.outcome === "escaped" ? "+100" : r.outcome === "predicted" ? "predicted" : "void"}
                </Text>
                {r.bonus && <Text style={styles.rowBonus}>+50 crowd</Text>}
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.note}>Crowd bonuses keep settling as more people play.</Text>
        <Link href="/unpredictable/live" style={styles.link}>
          See how everyone answered
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 24, gap: 16 },
  card: {
    backgroundColor: "#14122B",
    borderColor: colors.accent,
    borderWidth: 2,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    gap: 4,
  },
  cardKicker: { color: colors.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1.5, marginBottom: 10 },
  cardLine: { color: colors.text, fontSize: 22, fontWeight: "700" },
  cardScore: { color: colors.text, fontSize: 96, fontWeight: "900", letterSpacing: -3, lineHeight: 104 },
  marks: { flexDirection: "row", gap: 6, marginTop: 14 },
  mark: { fontSize: 22 },
  cardFoot: { color: colors.dim, fontSize: 14, marginTop: 12 },
  button: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  buttonText: { color: "#0B0B12", fontSize: 18, fontWeight: "800" },
  list: { gap: 8 },
  row: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  rowText: { flex: 1, gap: 2 },
  rowPrompt: { color: colors.dim, fontSize: 13 },
  rowAnswer: { color: colors.text, fontSize: 17, fontWeight: "700" },
  rowRight: { alignItems: "flex-end", gap: 2 },
  rowOutcome: { color: colors.dim, fontSize: 14, fontWeight: "800" },
  rowBonus: { color: colors.win, fontSize: 12, fontWeight: "700" },
  note: { color: colors.dim, fontSize: 13, textAlign: "center" },
  link: { color: colors.accent, fontSize: 16, fontWeight: "700", textAlign: "center", paddingVertical: 12 },
});
