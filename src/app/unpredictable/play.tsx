import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useDeviceId } from "@/unpredictable/device";
import { Reveal } from "@/unpredictable/reveal";
import { Opponent } from "@/unpredictable/sprite";
import { fonts, outcomeColor, palette, unit } from "@/unpredictable/theme";
import {
  Blink,
  Body,
  Display,
  Flash,
  PixelBox,
  PixelButton,
  Screen,
  tap,
  thud,
  useShake,
} from "@/unpredictable/ui";

import { api } from "../../../convex/_generated/api";

const ROUND_SECONDS = 15;
const ROUND_MS = ROUND_SECONDS * 1000;

function SealSlot(props: { index: number; loop: boolean }) {
  const drop = useSharedValue(0);
  useEffect(() => {
    const land = withDelay(
      props.index * 350,
      withSequence(
        withTiming(1.15, { duration: 160, easing: Easing.steps(3) }),
        withTiming(1, { duration: 80, easing: Easing.steps(1) }),
      ),
    );
    drop.value = props.loop
      ? withRepeat(
          withSequence(land, withDelay(900, withTiming(0, { duration: 1 }))),
          -1,
        )
      : land;
    if (props.loop) return;
    const timer = setTimeout(thud, props.index * 350 + 160);
    return () => clearTimeout(timer);
  }, [drop, props.index, props.loop]);
  const style = useAnimatedStyle(() => ({
    opacity: drop.value === 0 ? 0.15 : 1,
    transform: [
      { translateY: (1 - Math.min(drop.value, 1)) * -40 },
      { scale: Math.max(drop.value, 0.6) },
    ],
  }));
  return (
    <Animated.View style={style}>
      <PixelBox color={palette.gold} fill={palette.goldDark} pad={unit * 2}>
        <Display size={16} color={palette.gold}>
          ?
        </Display>
      </PixelBox>
    </Animated.View>
  );
}

function Countdown(props: { seconds: number }) {
  const tense = props.seconds <= 5;
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!tense) return;
    pulse.value = withSequence(
      withTiming(1.5, { duration: 80, easing: Easing.steps(2) }),
      withTiming(1, { duration: 200, easing: Easing.steps(3) }),
    );
    tap();
  }, [props.seconds, tense, pulse]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
  const color = tense ? palette.pink : palette.cyan;
  return (
    <View style={styles.countdown}>
      <View style={styles.segments}>
        {Array.from({ length: ROUND_SECONDS }, (_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              { backgroundColor: i < props.seconds ? color : palette.border },
            ]}
          />
        ))}
      </View>
      <Animated.View style={style}>
        <Display size={20} color={color} testID="seconds-left">
          {String(props.seconds).padStart(2, "0")}
        </Display>
      </Animated.View>
    </View>
  );
}

export default function Play() {
  const router = useRouter();
  const deviceId = useDeviceId();
  const data = useQuery(
    api.unpredictable.game.session,
    deviceId ? { deviceId } : "skip",
  );
  const beginRound = useMutation(api.unpredictable.game.beginRound);
  const submit = useMutation(api.unpredictable.game.submit);

  const rounds = data?.session?.status === "ready" ? data.session.rounds : null;
  const [pinned, setPinned] = useState<number | null>(null);
  const firstOpen = rounds ? rounds.findIndex((r) => r.status !== "done") : -1;
  const cursor = pinned ?? (firstOpen === -1 ? null : firstOpen);
  const finished = rounds !== null && pinned === null && firstOpen === -1;
  const [answer, setAnswer] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [flash, setFlash] = useState({ count: 0, color: palette.pink });
  const answerRef = useRef("");
  const sentFor = useRef<string | null>(null);
  const { style: shakeStyle, shake } = useShake();

  useEffect(() => {
    if (finished) router.replace("/unpredictable/result");
  }, [finished, router]);

  const round = rounds && cursor !== null ? rounds[cursor] : null;
  const roundId = round?._id ?? null;
  const open = round?.status === "open";
  const startedAt = round?.startedAt ?? null;

  const send = (id: NonNullable<typeof roundId>) => {
    if (!deviceId || sentFor.current === id) return;
    sentFor.current = id;
    setPinned(cursor);
    thud();
    void submit({ deviceId, roundId: id, answer: answerRef.current });
  };

  useEffect(() => {
    if (!open || !roundId || startedAt === null) return;
    const end =
      Date.now() +
      Math.max(0, Math.min(ROUND_MS, startedAt + ROUND_MS - Date.now()));
    const tick = setInterval(() => {
      const left = end - Date.now();
      setSecondsLeft(Math.max(0, Math.ceil(left / 1000)));
      if (left <= 0) {
        clearInterval(tick);
        send(roundId);
      }
    }, 200);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roundId, startedAt]);

  if (!deviceId || data === undefined || !rounds || !round) {
    return (
      <Screen>
        <View style={styles.center}>
          <Opponent mood="thinking" scale={10} />
          <View style={styles.seals}>
            {[0, 1, 2].map((i) => (
              <SealSlot key={i} index={i} loop />
            ))}
          </View>
          <Display size={12} style={styles.centerText}>
            SEALING GUESSES
          </Display>
          <Blink>
            <Body color={palette.dim} size={22} style={styles.centerText}>
              three for every prompt, locked before you see anything...
            </Body>
          </Blink>
        </View>
      </Screen>
    );
  }

  const hud = (
    <View style={styles.hud}>
      <Display size={9} color={palette.cyan}>
        {"ROUND " + (round.index + 1) + "/" + rounds.length}
      </Display>
      <View style={styles.dots}>
        {rounds.map((r) => (
          <View
            key={r._id}
            style={[
              styles.dot,
              r.outcome !== null && {
                backgroundColor: outcomeColor[r.outcome],
              },
              r.index === round.index &&
                r.outcome === null && { backgroundColor: palette.text },
            ]}
          />
        ))}
      </View>
    </View>
  );

  if (round.status === "done" && round.reveal && round.outcome) {
    const last = cursor === rounds.length - 1;
    return (
      <Screen
        shake={shakeStyle}
        flash={<Flash color={flash.color} trigger={flash.count} />}
      >
        <View style={styles.pad}>
          {hud}
          <Reveal
            key={round._id}
            deviceId={deviceId}
            roundId={round._id}
            prompt={round.prompt ?? ""}
            answer={round.answer}
            outcome={round.outcome}
            judgeReason={round.judgeReason}
            {...round.reveal}
            last={last}
            onVerdict={(outcome) => {
              setFlash((f) => ({
                count: f.count + 1,
                color: outcomeColor[outcome],
              }));
              shake(outcome === "predicted" ? 14 : 6);
            }}
            onNext={() => {
              if (last) return router.replace("/unpredictable/result");
              answerRef.current = "";
              setAnswer("");
              setSecondsLeft(ROUND_SECONDS);
              setPinned(cursor! + 1);
            }}
          />
        </View>
      </Screen>
    );
  }

  if (round.status === "sealed") {
    return (
      <Screen>
        <View style={styles.pad}>
          {hud}
          <View style={styles.center}>
            <Opponent mood="idle" scale={10} />
            <View style={styles.seals}>
              {[0, 1, 2].map((i) => (
                <SealSlot key={round._id + i} index={i} loop={false} />
              ))}
            </View>
            <Display size={12} style={styles.centerText}>
              3 GUESSES SEALED
            </Display>
            <Body color={palette.dim} size={22} style={styles.centerText}>
              you get 15 seconds and one to four words.
            </Body>
          </View>
          <PixelButton
            testID="reveal-prompt"
            label="SHOW PROMPT ▶"
            onPress={() => {
              setPinned(cursor);
              void beginRound({ deviceId, roundId: round._id });
            }}
          />
        </View>
      </Screen>
    );
  }

  if (round.status === "judging") {
    return (
      <Screen>
        <View style={styles.pad}>
          {hud}
          <View style={styles.center}>
            <Opponent mood="thinking" scale={10} />
            <Body color={palette.dim} size={22} style={styles.centerText}>
              {round.prompt}
            </Body>
            <Body size={36} style={styles.centerText}>
              {"> " + round.answer}
            </Body>
            <Blink>
              <Display size={10} color={palette.gold} style={styles.centerText}>
                BREAKING THE SEALS...
              </Display>
            </Blink>
          </View>
        </View>
      </Screen>
    );
  }

  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
  const canSend = wordCount >= 1 && wordCount <= 4;
  const tense = secondsLeft <= 5;

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.pad}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {hud}
        <Countdown seconds={secondsLeft} />
        <PixelBox color={tense ? palette.pink : palette.border}>
          <Display size={15} testID="prompt-text" style={styles.prompt}>
            {round.prompt}
          </Display>
        </PixelBox>
        <View style={styles.gap} />
        <PixelBox pad={0} color={palette.cyan}>
          <TextInput
            testID="answer-input"
            style={styles.input}
            value={answer}
            onChangeText={(text) => {
              answerRef.current = text;
              setAnswer(text);
            }}
            placeholder="one to four words"
            placeholderTextColor={palette.dim}
            autoFocus
            autoCorrect={false}
            maxLength={60}
            returnKeyType="send"
            onSubmitEditing={() => canSend && send(round._id)}
          />
        </PixelBox>
        <Body
          color={wordCount > 4 ? palette.pink : palette.dim}
          size={20}
          style={styles.hint}
        >
          {wordCount > 4
            ? "four words at most"
            : "no right answer. just don't be obvious."}
        </Body>
        <PixelButton
          testID="lock-in"
          label="LOCK IN"
          disabled={!canSend}
          onPress={() => send(round._id)}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { flex: 1, padding: unit * 5 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: unit * 4,
  },
  centerText: { textAlign: "center" },
  hud: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: unit * 4,
  },
  dots: { flexDirection: "row", gap: unit * 1.5 },
  dot: { width: unit * 3, height: unit * 3, backgroundColor: palette.border },
  seals: {
    flexDirection: "row",
    gap: unit * 4,
    height: 64,
    alignItems: "center",
  },
  countdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: unit * 3,
    marginBottom: unit * 4,
  },
  segments: { flex: 1, flexDirection: "row", gap: 3 },
  segment: { flex: 1, height: unit * 4 },
  prompt: { lineHeight: 26 },
  gap: { height: unit * 3 },
  input: {
    fontFamily: fonts.body,
    fontSize: 32,
    color: palette.text,
    paddingHorizontal: unit * 3,
    paddingVertical: unit * 3,
  },
  hint: { marginVertical: unit * 2 },
});
