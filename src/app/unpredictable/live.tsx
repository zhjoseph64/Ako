import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { palette, unit } from "@/unpredictable/theme";
import {
  BackLink,
  Blink,
  Body,
  Display,
  PixelBox,
  Screen,
  tap,
} from "@/unpredictable/ui";

import { api } from "../../../convex/_generated/api";

const BLOCKS = 20;

function Bar(props: { share: number; max: number; color: string }) {
  const lit =
    props.share === 0
      ? 0
      : Math.max(1, Math.round((props.share / props.max) * BLOCKS));
  return (
    <View style={styles.bar}>
      {Array.from({ length: BLOCKS }, (_, i) => (
        <View
          key={i}
          style={[
            styles.block,
            { backgroundColor: i < lit ? props.color : palette.panel },
          ]}
        />
      ))}
    </View>
  );
}

export default function Live() {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const prompts = useQuery(api.unpredictable.crowd.prompts, { now });
  const [selected, setSelected] = useState(0);
  const prompt = prompts?.[selected];
  const data = useQuery(
    api.unpredictable.crowd.distribution,
    prompt ? { promptId: prompt._id } : "skip",
  );

  const humans = Math.max(data?.humans ?? 0, 1);
  const ai = Math.max(data?.ai ?? 0, 1);
  const max = Math.max(
    0.01,
    ...(data?.clusters ?? []).flatMap((c) => [
      c.humanCount / humans,
      c.aiCount / ai,
    ]),
  );

  return (
    <Screen>
      <View style={styles.pad}>
        <View style={styles.head}>
          <BackLink onPress={() => router.back()} />
          <View style={styles.liveTag}>
            <Blink>
              <View style={styles.liveDot} />
            </Blink>
            <Display size={8} color={palette.pink}>
              LIVE
            </Display>
          </View>
        </View>
        <Display size={12} color={palette.cyan}>
          HUMANS VS THE AI
        </Display>
        <View style={styles.tabs}>
          {(prompts ?? []).map((p, i) => (
            <Pressable
              key={p._id}
              testID={`prompt-tab-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`Prompt ${i + 1}`}
              onPress={() => {
                tap();
                setSelected(i);
              }}
              style={[styles.tab, i === selected && styles.tabOn]}
            >
              <Display
                size={10}
                color={i === selected ? palette.bg : palette.dim}
              >
                {String(i + 1)}
              </Display>
            </Pressable>
          ))}
        </View>
        <PixelBox>
          <Display size={11} style={styles.prompt}>
            {prompt?.text ?? " "}
          </Display>
        </PixelBox>
        <View style={styles.legend}>
          <Body color={palette.cyan} size={20} testID="human-total">
            {"■ " + (data?.humans ?? 0) + " humans"}
          </Body>
          <Body color={palette.pink} size={20}>
            {"■ " + (data?.ai ?? 0) + " AI samples"}
          </Body>
        </View>
        <ScrollView contentContainerStyle={styles.rows}>
          {data?.clusters.map((c) => {
            const human = c.humanCount / humans;
            const aiShare = c.aiCount / ai;
            return (
              <View key={c._id} style={styles.row}>
                <View style={styles.rowHead}>
                  <Body size={24} numberOfLines={1} style={styles.label}>
                    {c.label}
                  </Body>
                  <Body size={20} color={palette.cyan}>
                    {Math.round(human * 100) + "%"}
                  </Body>
                  <Body size={20} color={palette.pink}>
                    {Math.round(aiShare * 100) + "%"}
                  </Body>
                </View>
                <Bar share={human} max={max} color={palette.cyan} />
                <Bar share={aiShare} max={max} color={palette.pink} />
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { flex: 1, padding: unit * 5, gap: unit * 3 },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  liveTag: { flexDirection: "row", alignItems: "center", gap: unit * 2 },
  liveDot: { width: unit * 2, height: unit * 2, backgroundColor: palette.pink },
  tabs: { flexDirection: "row", gap: unit * 2 },
  tab: {
    width: 40,
    height: 40,
    borderWidth: 3,
    borderColor: palette.border,
    backgroundColor: palette.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  tabOn: { backgroundColor: palette.cyan, borderColor: palette.text },
  prompt: { lineHeight: 20 },
  legend: { flexDirection: "row", gap: unit * 5 },
  rows: { gap: unit * 3, paddingBottom: 40 },
  row: { gap: 3 },
  rowHead: { flexDirection: "row", gap: unit * 3, alignItems: "baseline" },
  label: { flex: 1 },
  bar: { flexDirection: "row", gap: 2 },
  block: { flex: 1, height: unit * 2 },
});
