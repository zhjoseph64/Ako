import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { ComponentRef, useEffect, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { useDeviceId } from "@/unpredictable/device";
import { Heart, Opponent } from "@/unpredictable/sprite";
import {
  outcomeColor,
  palette,
  unit,
  WATER_BANDS,
} from "@/unpredictable/theme";
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
  const survived = loaded && summary.finished && !summary.over;

  useEffect(() => {
    if (loaded) buzz(survived ? "win" : "lose");
  }, [loaded, survived]);

  if (summary === undefined) return <Screen>{null}</Screen>;
  if (summary === null) {
    return (
      <Screen>
        <View style={styles.empty}>
          <BackLink onPress={() => router.dismissTo("/unpredictable")} />
          <View style={styles.emptyBody}>
            <Opponent mood="idle" scale={6} />
            <Display size={14} style={styles.centerText}>
              NO RUN YET TODAY
            </Display>
            <PixelButton
              label="▼ DIVE IN ▼"
              testID="result-play"
              onPress={() => router.dismissTo("/unpredictable")}
            />
          </View>
        </View>
      </Screen>
    );
  }

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

  const headline = summary.over
    ? "THE SQUID GOT ME IN " +
      summary.played +
      (summary.played === 1 ? " ROUND" : " ROUNDS")
    : survived
      ? "I SURVIVED WITH " +
        summary.lives +
        (summary.lives === 1 ? " LIFE" : " LIVES")
      : "STILL SWIMMING";

  return (
    <Screen>
      {survived && <Confetti />}
      <ScrollView contentContainerStyle={styles.scroll}>
        <BackLink onPress={() => router.dismissTo("/unpredictable")} />
        <View
          ref={card}
          collapsable={false}
          style={styles.capture}
          testID="share-card"
        >
          <PixelBox
            color={survived ? palette.green : palette.cyan}
            fill={WATER_BANDS[4]}
            pad={unit * 5}
          >
            <View style={styles.card}>
              <Display size={8} color={palette.cyan}>
                {"UNPREDICTABLE · " + summary.day}
              </Display>
              <Opponent mood={survived ? "defeated" : "smug"} scale={6} />
              <Display
                size={13}
                color={summary.over ? palette.pink : palette.green}
                style={styles.headline}
                testID="headline"
              >
                {headline}
              </Display>
              <View style={styles.hearts}>
                {[0, 1, 2].map((i) => (
                  <Heart key={i} full={i < summary.lives} scale={4} />
                ))}
              </View>
              <View style={styles.marks}>
                {summary.rounds.map((r) => (
                  <View
                    key={r.index}
                    style={[
                      styles.mark,
                      {
                        backgroundColor: r.outcome
                          ? outcomeColor[r.outcome]
                          : palette.panel,
                      },
                    ]}
                  />
                ))}
              </View>
              <Display
                size={30}
                color={palette.gold}
                testID="points"
                style={styles.points}
              >
                {String(points)}
              </Display>
              <Display size={9} color={palette.gold}>
                POINTS
              </Display>
              <Body
                color={palette.text}
                size={9}
                style={styles.centerText}
                testID="score"
              >
                {"outsmarted the squid " +
                  summary.escaped +
                  " of " +
                  summary.played +
                  " times"}
              </Body>
              <Body color={palette.dim} size={9} style={styles.centerText}>
                {summary.name +
                  (summary.lifePoints > 0
                    ? " · +" + summary.lifePoints + " life bonus"
                    : "") +
                  (summary.bonus > 0
                    ? " · " + summary.bonus + " crowd bonus"
                    : "")}
              </Body>
            </View>
          </PixelBox>
        </View>

        <PixelButton label="SHARE CARD" onPress={share} testID="share-button" />

        <View style={styles.list}>
          {summary.rounds
            .filter((r) => r.outcome !== null)
            .map((r) => (
              <PixelBox key={r.index} pad={unit * 2.5}>
                <View style={styles.row}>
                  <View style={styles.rowText}>
                    <Body color={palette.dim} size={8}>
                      {r.prompt}
                    </Body>
                    <Body size={11}>{r.answer || "..."}</Body>
                  </View>
                  <View style={styles.rowRight}>
                    <Display
                      size={9}
                      color={r.outcome ? outcomeColor[r.outcome] : palette.dim}
                    >
                      {r.outcome === "escaped"
                        ? "+100"
                        : r.outcome === "predicted"
                          ? "-1 ♥"
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
        <Body color={palette.dim} size={8} style={styles.centerText}>
          crowd bonuses keep settling as more people play.
        </Body>
        <PixelButton
          label="LIVE ROOM ▶"
          tone="gold"
          onPress={() => router.push("/unpredictable/live")}
          testID="live-button"
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: unit * 5, gap: unit * 4 },
  empty: { flex: 1, padding: unit * 5 },
  emptyBody: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: unit * 6,
  },
  capture: { backgroundColor: palette.bg, padding: unit },
  card: { alignItems: "center", gap: unit * 3 },
  centerText: { textAlign: "center" },
  headline: {
    textAlign: "center",
    textShadowColor: palette.ink,
    textShadowRadius: 0,
    textShadowOffset: { width: 2, height: 2 },
  },
  hearts: { flexDirection: "row", gap: unit * 2 },
  points: {
    lineHeight: 40,
    textShadowColor: palette.goldDark,
    textShadowRadius: 0,
    textShadowOffset: { width: 3, height: 3 },
  },
  marks: { flexDirection: "row", gap: unit * 2 },
  mark: {
    width: unit * 5,
    height: unit * 5,
    borderWidth: 2,
    borderColor: palette.ink,
  },
  list: { gap: unit * 2 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: unit * 3,
  },
  rowText: { flex: 1, gap: unit },
  rowRight: { alignItems: "flex-end", gap: unit },
});
