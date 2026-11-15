import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/unpredictable/theme";

import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

type Props = {
  deviceId: string;
  roundId: Id<"unpRounds">;
  prompt: string;
  answer: string | null;
  outcome: "predicted" | "escaped" | "void";
  judgeReason: string | null;
  guesses: string[];
  matchedGuess: number | null;
  reason: string;
  usedMemory: boolean;
  last: boolean;
  onNext: () => void;
};

const RESULT = {
  predicted: { title: "PREDICTED", sub: "The AI saw you coming.", color: colors.lose },
  escaped: { title: "UNPREDICTABLE", sub: "None of its guesses got you.", color: colors.win },
  void: { title: "VOID", sub: "This round doesn't count.", color: colors.void },
};

const FLIP_GAP = 850;

export function Reveal(props: Props) {
  const crowd = useQuery(api.unpredictable.game.roundCrowd, {
    deviceId: props.deviceId,
    roundId: props.roundId,
  });
  const [flips] = useState(() => props.guesses.map(() => new Animated.Value(0)));
  const [result] = useState(() => new Animated.Value(0));
  const [after] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.sequence([
      Animated.delay(500),
      Animated.stagger(
        FLIP_GAP,
        flips.map((flip) =>
          Animated.timing(flip, {
            toValue: 1,
            duration: 520,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ),
      Animated.delay(250),
      Animated.spring(result, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.timing(after, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [flips, result, after]);

  const verdict = RESULT[props.outcome];

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Text style={styles.prompt}>{props.prompt}</Text>
        <Text style={styles.answer} testID="your-answer">
          {props.answer ? `“${props.answer}”` : "No answer"}
        </Text>
      </View>

      <View style={styles.cards}>
        <Text style={styles.section}>THE AI&apos;S SEALED GUESSES</Text>
        {props.guesses.map((guess, i) => {
          const hit = props.matchedGuess === i;
          const frontRotate = flips[i].interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
          const backRotate = flips[i].interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });
          return (
            <View key={i} style={styles.cardSlot}>
              <Animated.View
                style={[styles.card, styles.cardFront, { transform: [{ perspective: 800 }, { rotateX: frontRotate }] }]}
              >
                <Text style={styles.lock}>🔒  Guess {i + 1}</Text>
              </Animated.View>
              <Animated.View
                style={[
                  styles.card,
                  styles.cardBack,
                  hit && styles.cardHit,
                  { transform: [{ perspective: 800 }, { rotateX: backRotate }] },
                ]}
              >
                <Text style={[styles.guess, hit && styles.guessHit]}>{guess}</Text>
                {hit && <Text style={styles.hitTag}>GOT YOU</Text>}
              </Animated.View>
            </View>
          );
        })}
      </View>

      <Animated.View
        style={[
          styles.result,
          {
            opacity: result,
            transform: [{ scale: result.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          },
        ]}
      >
        <Text style={[styles.resultTitle, { color: verdict.color }]} testID="round-result">
          {verdict.title}
        </Text>
        <Text style={styles.resultSub}>
          {props.outcome === "void" && props.judgeReason ? props.judgeReason : verdict.sub}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.after, { opacity: after }]}>
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>{props.usedMemory ? "🧠 AI, FROM MEMORY" : "🤖 AI"}</Text>
          <Text style={styles.reason}>{props.reason}</Text>
        </View>
        {crowd && (
          <View style={styles.crowdRow}>
            <Text style={styles.crowd} testID="crowd-stat">
              {crowd.total <= 1
                ? "You're the first human to say this."
                : `You're one of ${crowd.percent}% who said “${crowd.label}”`}
            </Text>
            {crowd.bonus && <Text style={styles.bonus}>+50 crowd bonus</Text>}
          </View>
        )}
        <Pressable style={styles.next} onPress={props.onNext} testID="next-button">
          <Text style={styles.nextText}>{props.last ? "See my score" : "Next prompt"}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "space-between" },
  top: { gap: 6, marginTop: 8 },
  prompt: { color: colors.dim, fontSize: 16, fontWeight: "600" },
  answer: { color: colors.text, fontSize: 30, fontWeight: "800" },
  section: { color: colors.dim, fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginBottom: 2 },
  cards: { gap: 10 },
  cardSlot: { height: 62 },
  card: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backfaceVisibility: "hidden",
  },
  cardFront: { backgroundColor: colors.cardHi, borderColor: colors.border },
  cardBack: { backgroundColor: colors.card, borderColor: colors.border },
  cardHit: { backgroundColor: "#3A1522", borderColor: colors.lose },
  lock: { color: colors.dim, fontSize: 16, fontWeight: "700" },
  guess: { color: colors.text, fontSize: 20, fontWeight: "700", flexShrink: 1 },
  guessHit: { color: colors.lose },
  hitTag: { color: colors.lose, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  result: { alignItems: "center", gap: 4 },
  resultTitle: { fontSize: 34, fontWeight: "900", letterSpacing: 1 },
  resultSub: { color: colors.dim, fontSize: 15, textAlign: "center" },
  after: { gap: 12 },
  reasonBox: { backgroundColor: colors.card, borderRadius: 14, padding: 14, gap: 4 },
  reasonLabel: { color: colors.ai, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  reason: { color: colors.text, fontSize: 15, lineHeight: 21 },
  crowdRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" },
  crowd: { color: colors.accent, fontSize: 15, fontWeight: "700", textAlign: "center" },
  bonus: {
    color: "#0B0B12",
    backgroundColor: colors.win,
    borderRadius: 8,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 12,
    fontWeight: "800",
  },
  next: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  nextText: { color: "#0B0B12", fontSize: 18, fontWeight: "800" },
});
