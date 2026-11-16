import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import type { Doc } from "../../convex/_generated/dataModel";
import { compileWinRegex, VICTORY_CREDITS, wholeWordRegex } from "../../convex/jailbreak/evaluator";
import { colors, KNIGHT_COLORS, PIXEL_FONT } from "./theme";
import { PixelButton, PixelPanel, PixelText } from "./ui";

const FLASH_AT = 1100;
const CONFETTI_AT = 1250;
const PANEL_AT = 3300;
const CONFETTI_COUNT = 44;
const CONFETTI_COLORS = [colors.gold, colors.ember, colors.full, colors.rune, colors.parchment, ...KNIGHT_COLORS.slice(0, 4)];

function highlightParts(reply: string, room: Doc<"jbRooms">): { text: string; hit: boolean }[] {
  if (room.winCheckType === "exact") return [{ text: reply, hit: true }];
  const base = room.winCheckType === "word" ? wholeWordRegex(room.winCheck) : compileWinRegex(room.winCheck);
  const pattern = new RegExp(base.source, base.flags.includes("g") ? base.flags : `${base.flags}g`);
  const parts: { text: string; hit: boolean }[] = [];
  let last = 0;
  for (const match of reply.matchAll(pattern)) {
    if (!match[0]) continue;
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: reply.slice(last, start), hit: false });
    parts.push({ text: match[0], hit: true });
    last = start + match[0].length;
  }
  if (last < reply.length) parts.push({ text: reply.slice(last), hit: false });
  return parts;
}

function noise(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function Confetti({ width, height }: { width: number; height: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        x: noise(i + 1) * width,
        drift: (noise(i + 101) - 0.5) * 80,
        size: 6 + Math.round(noise(i + 201) * 3) * 2,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: noise(i + 301) * 600,
        duration: 1800 + noise(i + 401) * 1400,
        progress: new Animated.Value(0),
      })),
    [width],
  );

  useEffect(() => {
    Animated.parallel(
      pieces.map((piece) =>
        Animated.timing(piece.progress, {
          toValue: 1,
          duration: piece.duration,
          delay: piece.delay,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [pieces]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: piece.x,
            top: -20,
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            borderWidth: 1,
            borderColor: colors.ink,
            opacity: piece.progress.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: piece.progress.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
              { translateX: piece.progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, piece.drift, piece.drift / 2] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

export function VictoryOverlay({
  room,
  winningAttack,
  model,
  myId,
  winnerCredits,
  celebrate,
  onPlayAgain,
  onBack,
  onReadLedger,
}: {
  room: Doc<"jbRooms">;
  winningAttack: Doc<"jbAttacks"> | null;
  model: string;
  myId: string;
  winnerCredits: number | undefined;
  celebrate: boolean;
  onPlayAgain: () => Promise<void>;
  onBack: () => void;
  onReadLedger: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [animate] = useState(celebrate);
  const [phase, setPhase] = useState<"intro" | "party" | "panel">(animate ? "intro" : "panel");
  const [flash] = useState(() => new Animated.Value(0));
  const [reveal] = useState(() => new Animated.Value(animate ? 0 : 1));
  const [restarting, setRestarting] = useState(false);
  const iWon = room.winnerId === myId;

  useEffect(() => {
    if (!animate) return;
    const timers = [
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Animated.sequence([
          Animated.timing(flash, { toValue: 0.85, duration: 140, useNativeDriver: true }),
          Animated.timing(flash, { toValue: 0, duration: 700, useNativeDriver: true }),
        ]).start();
      }, FLASH_AT),
      setTimeout(() => setPhase("party"), CONFETTI_AT),
      setTimeout(() => {
        setPhase("panel");
        Animated.spring(reveal, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }).start();
      }, PANEL_AT),
    ];
    return () => timers.forEach(clearTimeout);
  }, [animate, flash, reveal]);

  async function playAgain() {
    setRestarting(true);
    try {
      await onPlayAgain();
    } finally {
      setRestarting(false);
    }
  }

  const parts = winningAttack?.reply ? highlightParts(winningAttack.reply, room) : [];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={phase === "panel" ? "auto" : "none"} testID="jb-victory">
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#fff6d8", opacity: flash }]} />
      {phase !== "intro" && <Confetti width={width} height={height} />}
      {phase === "panel" && (
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" }),
            },
          ]}
        >
          <Animated.View
            style={{
              width: "100%",
              maxWidth: 520,
              maxHeight: "100%",
              transform: [
                { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
                { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
              ],
            }}
          >
            <PixelPanel style={styles.panel}>
              <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <PixelText size={20} color={colors.gold} style={styles.title} testID="jb-victory-title">
                  Boss defeated
                </PixelText>
                <PixelText size={9} color={colors.parchment} style={styles.center}>
                  {iWon ? `You broke ${room.bossName}!` : `${room.winnerName ?? "A knight"} broke ${room.bossName}`}
                </PixelText>

                <View style={styles.credits} testID="jb-victory-credits">
                  <PixelText size={14} color={colors.ink}>{`+${VICTORY_CREDITS} CREDITS`}</PixelText>
                  <PixelText size={7} color={colors.ink}>
                    {iWon
                      ? `Your total: ${winnerCredits ?? VICTORY_CREDITS}`
                      : `Earned by ${room.winnerName ?? "the winner"} · total ${winnerCredits ?? VICTORY_CREDITS}`}
                  </PixelText>
                </View>

                <PixelText size={7} color={colors.gold}>WINNING PROMPT</PixelText>
                <View style={styles.box}>
                  <PixelText size={9} color={colors.parchment} selectable testID="jb-victory-prompt">
                    {winningAttack?.prompt ?? "…"}
                  </PixelText>
                </View>

                <PixelText size={7} color={colors.gold}>{`BOSS RESPONSE · ${winningAttack?.adapter ?? model}`}</PixelText>
                <View style={[styles.box, styles.replyBox]}>
                  <Text style={styles.reply} selectable testID="jb-victory-reply">
                    {parts.length
                      ? parts.map((part, i) =>
                          part.hit ? (
                            <Text key={i} style={styles.hit}>
                              {part.text}
                            </Text>
                          ) : (
                            part.text
                          ),
                        )
                      : "…"}
                  </Text>
                </View>

                <PixelButton
                  label={restarting ? "Reviving…" : "Play Again"}
                  tone="ember"
                  size={13}
                  onPress={playAgain}
                  disabled={restarting}
                  style={styles.bigButton}
                  testID="jb-play-again"
                />
                <PixelButton label="Back to Games" tone="stone" size={13} onPress={onBack} style={styles.bigButton} testID="jb-back-to-games" />
                <PixelButton
                  label={iWon ? "Read your ledger" : `Read ${room.winnerName ?? "winner"}'s ledger`}
                  tone="rune"
                  size={8}
                  onPress={onReadLedger}
                  style={{ alignSelf: "center" }}
                  testID="jb-victory-ledger"
                />
              </ScrollView>
            </PixelPanel>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(20,12,24,0.82)",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  panel: { maxHeight: "100%" },
  content: { gap: 8, paddingVertical: 4 },
  title: { textAlign: "center", lineHeight: 34, textShadowColor: colors.lava, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
  center: { textAlign: "center" },
  credits: {
    alignSelf: "center",
    alignItems: "center",
    backgroundColor: colors.gold,
    borderWidth: 3,
    borderColor: colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginVertical: 4,
  },
  box: { backgroundColor: colors.night, borderWidth: 3, borderColor: colors.ink, padding: 8 },
  replyBox: { backgroundColor: colors.parchment },
  reply: { fontFamily: PIXEL_FONT, fontSize: 9, lineHeight: 16, color: colors.ink },
  hit: { backgroundColor: colors.gold, color: colors.lava, textDecorationLine: "underline" },
  bigButton: { alignSelf: "stretch", paddingVertical: 6 },
});
