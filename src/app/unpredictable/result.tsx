import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { ComponentRef, useEffect, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { useDeviceId } from "@/unpredictable/device";
import { Opponent } from "@/unpredictable/sprite";
import { outcomeColor, palette, unit } from "@/unpredictable/theme";
import {
  BackLink,
  Body,
  buzz,
  Confetti,
  Display,
  PixelBox,
  PixelButton,
  Screen,
  useCountUp,
} from "@/unpredictable/ui";

import { api } from "../../../convex/_generated/api";

export default function Result() {
  const router = useRouter();
  const deviceId = useDeviceId();
  const summary = useQuery(
    api.unpredictable.game.summary,
    deviceId ? { deviceId } : "skip",
  );
  const card = useRef<ComponentRef<typeof View>>(null);
  const points = useCountUp(summary?.points ?? 0, summary != null, 40);
  const loaded = summary != null;
  const beatIt = loaded && summary.predicted * 2 < summary.total;

  useEffect(() => {
    if (loaded) buzz(beatIt ? "win" : "lose");
  }, [loaded, beatIt]);

  if (!summary) return <Screen>{null}</Screen>;

  const share = async () => {
    try {
      if (!(await Sharing.isAvailableAsync())) return;
      const uri = await captureRef(card, { format: "png", quality: 1 });
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        UTI: "public.png",
      });
    } catch (error) {
      console.warn("Sharing failed", error);
    }
  };

  return (
    <Screen>
      {beatIt && <Confetti />}
      <ScrollView contentContainerStyle={styles.scroll}>
        <BackLink onPress={() => router.dismissTo("/unpredictable")} />
        <View
          ref={card}
          collapsable={false}
          style={styles.capture}
          testID="share-card"
        >
          <PixelBox
            color={palette.cyan}
            shadow={palette.cyanDark}
            fill={palette.deep}
            pad={unit * 5}
          >
            <View style={styles.card}>
              <Display size={8} color={palette.cyan}>
                {"UNPREDICTABLE · " + summary.day}
              </Display>
              <Opponent mood={beatIt ? "defeated" : "smug"} scale={7} />
              <Display size={11} style={styles.centerText}>
                THE AI PREDICTED ME
              </Display>
              <Display
                size={56}
                testID="score"
                style={[styles.score, { textShadowColor: palette.cyan }]}
              >
                {summary.predicted + "/" + summary.total}
              </Display>
              <Display size={11}>TODAY</Display>
              <View style={styles.marks}>
                {summary.rounds.map((r) => (
                  <View
                    key={r.index}
                    style={[
                      styles.mark,
                      {
                        backgroundColor: r.outcome
                          ? outcomeColor[r.outcome]
                          : palette.border,
                      },
                    ]}
                  />
                ))}
              </View>
              <Body color={palette.gold} size={30} testID="points">
                {points + " PTS"}
              </Body>
              <Body color={palette.dim} size={20}>
                {summary.name +
                  (summary.bonus > 0
                    ? " · " + summary.bonus + " crowd bonus"
                    : "")}
              </Body>
            </View>
          </PixelBox>
        </View>

        <PixelButton label="SHARE CARD" onPress={share} testID="share-button" />

        <View style={styles.list}>
          {summary.rounds.map((r) => (
            <PixelBox key={r.index} pad={unit * 2.5}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Body color={palette.dim} size={18}>
                    {r.prompt}
                  </Body>
                  <Body size={24}>{r.answer || "..."}</Body>
                </View>
                <View style={styles.rowRight}>
                  <Display
                    size={9}
                    color={r.outcome ? outcomeColor[r.outcome] : palette.dim}
                  >
                    {r.outcome === "escaped"
                      ? "+100"
                      : r.outcome === "predicted"
                        ? "PREDICTED"
                        : "VOID"}
                  </Display>
                  {r.bonus && (
                    <Display size={7} color={palette.green}>
                      +50 CROWD
                    </Display>
                  )}
                </View>
              </View>
            </PixelBox>
          ))}
        </View>
        <Body color={palette.dim} size={18} style={styles.centerText}>
          crowd bonuses keep settling as more people play.
        </Body>
        <PixelButton
          label="LIVE ROOM ▶"
          color={palette.gold}
          shadow={palette.goldDark}
          onPress={() => router.push("/unpredictable/live")}
          testID="live-button"
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: unit * 5, gap: unit * 4 },
  capture: { backgroundColor: palette.bg, padding: unit },
  card: { alignItems: "center", gap: unit * 3 },
  centerText: { textAlign: "center" },
  score: {
    lineHeight: 72,
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  marks: { flexDirection: "row", gap: unit * 2 },
  mark: { width: unit * 5, height: unit * 5 },
  list: { gap: unit * 2 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: unit * 3,
  },
  rowText: { flex: 1, gap: 2 },
  rowRight: { alignItems: "flex-end", gap: unit },
});
