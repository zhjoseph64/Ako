import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Mood, Opponent } from "@/unpredictable/sprite";
import { outcomeColor, palette, unit } from "@/unpredictable/theme";
import {
  Body,
  buzz,
  Confetti,
  Display,
  PixelBox,
  PixelButton,
  thud,
  useCountUp,
} from "@/unpredictable/ui";

import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

type Outcome = "predicted" | "escaped" | "void";

type Props = {
  deviceId: string;
  roundId: Id<"unpRounds">;
  prompt: string;
  answer: string | null;
  outcome: Outcome;
  judgeReason: string | null;
  guesses: string[];
  matchedGuess: number | null;
  reason: string;
  usedMemory: boolean;
  nextLabel: string;
  onNext: () => void;
  onVerdict: (outcome: Outcome) => void;
};

const VERDICT: Record<Outcome, { title: string; sub: string; mood: Mood }> = {
  predicted: {
    title: "PREDICTED",
    sub: "the squid saw you coming. -1 life",
    mood: "smug",
  },
  escaped: {
    title: "UNPREDICTABLE!",
    sub: "none of its guesses got you.",
    mood: "defeated",
  },
  void: { title: "VOID", sub: "this round doesn't count.", mood: "idle" },
};

const FIRST_FLIP = 600;
const FLIP_GAP = 900;
const FLIP_MS = 380;

function GuessCard(props: { index: number; guess: string; hit: boolean }) {
  const flip = useSharedValue(0);
  useEffect(() => {
    const delay = FIRST_FLIP + props.index * FLIP_GAP;
    flip.value = withDelay(
      delay,
      withTiming(1, { duration: FLIP_MS, easing: Easing.steps(6) }),
    );
    const timer = setTimeout(thud, delay + FLIP_MS / 2);
    return () => clearTimeout(timer);
  }, [flip, props.index]);
  const front = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 1 : 0,
    transform: [{ scaleY: Math.max(0.05, 1 - flip.value * 2) }],
  }));
  const back = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 0 : 1,
    transform: [{ scaleY: Math.max(0.05, flip.value * 2 - 1) }],
  }));
  return (
    <View style={styles.slot}>
      <Animated.View style={[StyleSheet.absoluteFill, front]}>
        <PixelBox fill={palette.panelHi} style={styles.card}>
          <Body color={palette.dim}>{"SEALED GUESS " + (props.index + 1)}</Body>
          <Body color={palette.gold}>?</Body>
        </PixelBox>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, back]}>
        <PixelBox
          color={props.hit ? palette.pink : palette.border}
          fill={props.hit ? "#3a1230" : palette.panel}
          style={styles.card}
        >
          <Body
            size={11}
            color={props.hit ? palette.pink : palette.text}
            style={styles.guess}
            numberOfLines={1}
          >
            {props.guess}
          </Body>
          {props.hit && (
            <Display size={8} color={palette.pink}>
              GOT YOU
            </Display>
          )}
        </PixelBox>
      </Animated.View>
    </View>
  );
}

export function Reveal(props: Props) {
  const crowd = useQuery(api.unpredictable.game.roundCrowd, {
    deviceId: props.deviceId,
    roundId: props.roundId,
  });
  const [shown, setShown] = useState(false);
  const slam = useSharedValue(0);
  const after = useSharedValue(0);
  const bonus = useSharedValue(0);
  const { outcome, onVerdict } = props;
  const verdictAt = FIRST_FLIP + props.guesses.length * FLIP_GAP + 150;

  useEffect(() => {
    slam.value = withDelay(
      verdictAt,
      withSequence(
        withTiming(1.25, { duration: 90, easing: Easing.steps(2) }),
        withTiming(1, { duration: 120, easing: Easing.steps(2) }),
      ),
    );
    after.value = withDelay(
      verdictAt + 450,
      withTiming(1, { duration: 250, easing: Easing.steps(4) }),
    );
    const timer = setTimeout(() => {
      setShown(true);
      buzz(
        outcome === "escaped"
          ? "win"
          : outcome === "predicted"
            ? "lose"
            : "void",
      );
      onVerdict(outcome);
    }, verdictAt);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasBonus = crowd?.bonus === true;
  useEffect(() => {
    if (shown && hasBonus) {
      bonus.value = withDelay(
        900,
        withSpring(1, { damping: 6, stiffness: 220 }),
      );
    }
  }, [shown, hasBonus, bonus]);

  const points = useCountUp(outcome === "escaped" ? 100 : 0, shown);
  const slamStyle = useAnimatedStyle(() => ({
    opacity: slam.value === 0 ? 0 : 1,
    transform: [{ scale: slam.value === 0 ? 3 : slam.value }],
  }));
  const afterStyle = useAnimatedStyle(() => ({
    opacity: after.value,
    transform: [{ translateY: (1 - after.value) * 16 }],
  }));
  const bonusStyle = useAnimatedStyle(() => ({
    opacity: bonus.value === 0 ? 0 : 1,
    transform: [{ scale: bonus.value }],
  }));

  const verdict = VERDICT[outcome];
  const color = outcomeColor[outcome];

  return (
    <View style={styles.wrap}>
      {shown && outcome === "escaped" && <Confetti />}
      <View style={styles.top}>
        <Body color={palette.dim} size={9} numberOfLines={3}>
          {props.prompt}
        </Body>
        <Body
          size={13}
          color={palette.text}
          testID="your-answer"
          numberOfLines={2}
        >
          {props.answer ? "> " + props.answer : "> ..."}
        </Body>
      </View>

      <View style={styles.cards}>
        {props.guesses.map((guess, i) => (
          <GuessCard
            key={i}
            index={i}
            guess={guess}
            hit={props.matchedGuess === i}
          />
        ))}
      </View>

      <Animated.View style={[styles.verdict, slamStyle]}>
        <Display
          size={outcome === "escaped" ? 18 : 22}
          color={color}
          testID="round-result"
          style={styles.title}
        >
          {verdict.title}
        </Display>
        <Body color={palette.text} size={9} style={styles.center}>
          {outcome === "void" && props.judgeReason
            ? props.judgeReason.toLowerCase()
            : verdict.sub}
        </Body>
        {outcome === "escaped" && (
          <Display size={14} color={palette.gold} testID="points">
            {"+" + points}
          </Display>
        )}
      </Animated.View>

      <Animated.View style={[styles.after, afterStyle]}>
        <View style={styles.speech}>
          <Opponent mood={shown ? verdict.mood : "thinking"} scale={4} />
          <View style={styles.bubble}>
            <PixelBox pad={unit * 2}>
              <Display size={7} color={palette.gold}>
                {props.usedMemory ? "SQUID · FROM MEMORY" : "SQUID"}
              </Display>
              <Body size={8} numberOfLines={5}>
                {props.reason}
              </Body>
            </PixelBox>
          </View>
        </View>
        {crowd && (
          <View style={styles.crowdRow}>
            <Body
              color={palette.cyan}
              size={8}
              style={styles.center}
              testID="crowd-stat"
            >
              {crowd.total <= 1
                ? "you're the first human to say this."
                : `you're one of ${crowd.percent}% who said "${crowd.label}"`}
            </Body>
            {hasBonus && (
              <Animated.View style={[styles.bonus, bonusStyle]}>
                <Display size={8} color={palette.ink}>
                  +50 CROWD BONUS
                </Display>
              </Animated.View>
            )}
          </View>
        )}
        <PixelButton
          testID="next-button"
          label={props.nextLabel}
          onPress={props.onNext}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "space-between" },
  top: { gap: unit },
  cards: { gap: unit * 2 },
  slot: { height: 54 },
  card: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 0,
  },
  guess: { flexShrink: 1 },
  verdict: { alignItems: "center", gap: unit * 2 },
  title: {
    textAlign: "center",
    textShadowColor: palette.ink,
    textShadowRadius: 0,
    textShadowOffset: { width: 3, height: 3 },
  },
  center: { textAlign: "center" },
  after: { gap: unit * 3 },
  speech: { flexDirection: "row", alignItems: "center", gap: unit * 3 },
  bubble: { flex: 1 },
  crowdRow: { alignItems: "center", gap: unit * 2 },
  bonus: {
    backgroundColor: palette.green,
    borderWidth: 3,
    borderColor: palette.ink,
    paddingHorizontal: unit * 2,
    paddingVertical: unit * 1.5,
  },
});
