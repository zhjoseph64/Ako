import { useQuery } from "convex/react";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/unpredictable/theme";

import { api } from "../../../convex/_generated/api";

export default function Live() {
  const [now] = useState(() => Date.now());
  const prompts = useQuery(api.unpredictable.crowd.prompts, { now });
  const [selected, setSelected] = useState(0);
  const prompt = prompts?.[selected];
  const data = useQuery(
    api.unpredictable.crowd.distribution,
    prompt ? { promptId: prompt._id } : "skip",
  );

  const max = Math.max(
    0.01,
    ...(data?.clusters ?? []).flatMap((c) => [
      c.humanCount / Math.max(data!.humans, 1),
      c.aiCount / Math.max(data!.ai, 1),
    ]),
  );

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.kicker}>LIVE · HUMANS VS THE AI</Text>
      <View style={styles.tabs}>
        {(prompts ?? []).map((p, i) => (
          <Pressable
            key={p._id}
            testID={`prompt-tab-${i}`}
            style={[styles.tab, i === selected && styles.tabOn]}
            onPress={() => setSelected(i)}
          >
            <Text style={[styles.tabText, i === selected && styles.tabTextOn]}>{i + 1}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.prompt}>{prompt?.text ?? " "}</Text>
      <View style={styles.legend}>
        <Text style={[styles.legendItem, { color: colors.accent }]} testID="human-total">
          ■ {data?.humans ?? 0} human answers
        </Text>
        <Text style={[styles.legendItem, { color: colors.ai }]}>■ {data?.ai ?? 0} AI samples</Text>
      </View>
      <ScrollView contentContainerStyle={styles.rows}>
        {data?.clusters.map((c) => {
          const human = c.humanCount / Math.max(data.humans, 1);
          const ai = c.aiCount / Math.max(data.ai, 1);
          return (
            <View key={c._id} style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={styles.label} numberOfLines={1}>
                  {c.label}
                </Text>
                <Text style={styles.pct}>
                  <Text style={{ color: colors.accent }}>{Math.round(human * 100)}%</Text>
                  {"  "}
                  <Text style={{ color: colors.ai }}>{Math.round(ai * 100)}%</Text>
                </Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.bar, { backgroundColor: colors.accent, width: `${(human / max) * 100}%` }]} />
              </View>
              <View style={styles.track}>
                <View style={[styles.bar, { backgroundColor: colors.ai, width: `${(ai / max) * 100}%` }]} />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 24 },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 1.5 },
  tabs: { flexDirection: "row", gap: 8, marginTop: 14 },
  tab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  tabOn: { backgroundColor: colors.accent },
  tabText: { color: colors.dim, fontSize: 16, fontWeight: "800" },
  tabTextOn: { color: "#0B0B12" },
  prompt: { color: colors.text, fontSize: 26, fontWeight: "800", marginTop: 16 },
  legend: { flexDirection: "row", gap: 16, marginTop: 8, marginBottom: 12 },
  legendItem: { fontSize: 13, fontWeight: "700" },
  rows: { gap: 12, paddingBottom: 40 },
  row: { gap: 4 },
  rowHead: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  label: { color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 },
  pct: { fontSize: 13, fontWeight: "700" },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.card, overflow: "hidden" },
  bar: { height: 8, borderRadius: 4, minWidth: 2 },
});
