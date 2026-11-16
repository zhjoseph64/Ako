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
import { Heart, Opponent } from "@/unpredictable/sprite";
import { fonts, outcomeColor, palette, unit } from "@/unpredictable/theme";
import {
  Blink,
  Body,
  buzz,
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
const START_LIVES = 3;
const SEAL_BEAT_MS = 1900;

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

function Life(props: { full: boolean }) {
  const hit = useSharedValue(0);
  const wasFull = useRef(props.full);
  useEffect(() => {
    if (wasFull.current && !props.full) {
      hit.value = withSequence(
        withTiming(1, { duration: 80, easing: Easing.steps(1) }),
        withRepeat(
          withSequence(
            withTiming(0.4, { duration: 90, easing: Easing.steps(1) }),
            withTiming(1, { duration: 90, easing: Easing.steps(1) }),
          ),
          4,
        ),
        withTiming(0, { duration: 120, easing: Easing.steps(2) }),
      );
    }
    wasFull.current = props.full;
  }, [props.full, hit]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + hit.value * 0.9 }, { translateY: hit.value * 4 }],
  }));
  return (
    <Animated.View style={style}>
      <Heart full={props.full} />
    </Animated.View>
  );
}

function Lives(props: { lives: number }) {
  return (
    <View
      style={styles.lives}
      testID="lives"
      accessibilityLabel={props.lives + " lives"}
    >
      {Array.from({ length: START_LIVES }, (_, i) => (
        <Life key={i} full={i < props.lives} />
      ))}
    </View>
  );
}

function Countdown(props: { seconds: number }) {
  const tense = props.seconds <= 5;
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!tense) return;
    pulse.value = withSequence(
      withTiming(1.2, { duration: 80, easing: Easing.steps(2) }),
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
              { backgroundColor: i < props.seconds ? color : palette.panel },
            ]}
          />
        ))}
      </View>
      <Animated.View style={[styles.digits, style]}>
        <Display size={18} color={color} testID="seconds-left">
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

  const status = data?.session?.status;
  const over = status === "over";
  const rounds =
    data?.session && (status === "ready" || over) ? data.session.rounds : null;
  const [pinned, setPinned] = useState<number | null>(null);
  const firstOpen = rounds ? rounds.findIndex((r) => r.status !== "done") : -1;
  const cursor = pinned ?? (firstOpen === -1 || over ? null : firstOpen);
  const finished =
    rounds !== null && pinned === null && (firstOpen === -1 || over);
  const [answer, setAnswer] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [flash, setFlash] = useState({ count: 0, color: palette.pink });
  const [hitShown, setHitShown] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const answerRef = useRef("");
  const sentFor = useRef<string | null>(null);
  const { style: shakeStyle, shake } = useShake();

  useEffect(() => {
    if (finished) router.replace("/unpredictable/result");
  }, [finished, router]);

  const round = rounds && cursor !== null ? rounds[cursor] : null;
  const roundId = round?._id ?? null;
  const open = round?.status === "open";
  const sealed = round?.status === "sealed" && !over;
  const startedAt = round?.startedAt ?? null;

  const send = (id: NonNullable<typeof roundId>) => {
    if (!deviceId || sentFor.current === id) return;
    sentFor.current = id;
    setPinned(cursor);
    thud();
    void submit({ deviceId, roundId: id, answer: answerRef.current });
  };

  useEffect(() => {
    if (!sealed || !roundId || !deviceId) return;
    const timer = setTimeout(() => {
      setPinned(cursor);
      void beginRound({ deviceId, roundId });
    }, SEAL_BEAT_MS);
    return () => clearTimeout(timer);
  }, [sealed, roundId, deviceId, cursor, beginRound]);

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

  if (!deviceId || !data?.session || !rounds || !round) {
    return (
      <Screen>
        <View style={styles.center}>
          <Opponent mood="thinking" scale={8} />
          <View style={styles.seals}>
            {[0, 1, 2].map((i) => (
              <SealSlot key={i} index={i} loop />
            ))}
          </View>
          <Display size={12} style={styles.centerText}>
            SEALING GUESSES
          </Display>
          <Blink>
            <Body color={palette.dim} size={9} style={styles.centerText}>
              the squid is reading your mind...
            </Body>
          </Blink>
        </View>
      </Screen>
    );
  }

  const hitPending =
    round.status === "done" &&
    round.outcome === "predicted" &&
    hitShown !== round._id;
  const lives = Math.min(
    START_LIVES,
    data.session.lives + (hitPending ? 1 : 0),
  );
  const played = rounds.filter((r) => r.outcome !== null).length;

  if (gameOver) {
    return (
      <Screen
        shake={shakeStyle}
        flash={<Flash color={flash.color} trigger={flash.count} />}
      >
        <View style={styles.pad}>
          <View style={styles.center}>
            <Opponent mood="smug" scale={8} />
            <Display
              size={24}
              color={palette.pink}
              style={styles.gameOver}
              testID="game-over"
            >
              GAME OVER
            </Display>
            <Lives lives={0} />
            <Body size={10} style={styles.centerText}>
              {"the squid got you in " +
                played +
                (played === 1 ? " round." : " rounds.")}
            </Body>
          </View>
          <PixelButton
            testID="see-score"
            label="SEE MY SCORE ▶"
            tone="gold"
            onPress={() => router.replace("/unpredictable/result")}
          />
        </View>
      </Screen>
    );
  }

  const hud = (
    <View style={styles.hud}>
      <View style={styles.hudLeft}>
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
      <Lives lives={lives} />
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
            nextLabel={
              over ? "CONTINUE ▶" : last ? "SEE MY SCORE ▶" : "NEXT PROMPT ▶"
            }
            onVerdict={(outcome) => {
              setHitShown(round._id);
              setFlash((f) => ({
                count: f.count + 1,
                color: outcomeColor[outcome],
              }));
              shake(outcome === "predicted" ? 14 : 6);
            }}
            onNext={() => {
              if (over) {
                setGameOver(true);
                setFlash((f) => ({ count: f.count + 1, color: palette.pink }));
                shake(18);
                buzz("lose");
                return;
              }
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
            <Opponent mood="thinking" scale={8} />
            <View style={styles.seals}>
              {[0, 1, 2].map((i) => (
                <SealSlot key={round._id + i} index={i} loop={false} />
              ))}
            </View>
            <Display size={12} style={styles.centerText} testID="sealed">
              3 GUESSES SEALED
            </Display>
            <Blink ms={250}>
              <Body color={palette.gold} style={styles.centerText}>
                GET READY...
              </Body>
            </Blink>
          </View>
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
            <Opponent mood="thinking" scale={8} />
            <Body color={palette.dim} size={9} style={styles.centerText}>
              {round.prompt}
            </Body>
            <Body size={14} style={styles.centerText}>
              {"> " + (round.answer || "...")}
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
  const tooLong = wordCount > 4;
  const canSend = wordCount >= 1 && !tooLong;
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
          <Display size={13} testID="prompt-text" style={styles.prompt}>
            {round.prompt}
          </Display>
        </PixelBox>
        <View style={styles.gap} />
        <PixelBox
          pad={0}
          color={tooLong ? palette.gold : palette.cyan}
          fill={palette.deep}
        >
          <TextInput
            testID="answer-input"
            style={styles.input}
            value={answer}
            onChangeText={(text) => {
              answerRef.current = text;
              setAnswer(text);
            }}
            placeholder="your answer"
            placeholderTextColor={palette.dim}
            autoFocus
            autoCorrect={false}
            maxLength={60}
            returnKeyType="send"
            onSubmitEditing={() => canSend && send(round._id)}
          />
        </PixelBox>
        <Body
          color={tooLong ? palette.gold : palette.dim}
          size={8}
          style={styles.hint}
        >
          {tooLong
            ? "a little shorter, please. trim a word or two."
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
  gameOver: {
    textAlign: "center",
    textShadowColor: palette.ink,
    textShadowRadius: 0,
    textShadowOffset: { width: 4, height: 4 },
  },
  hud: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: unit * 4,
  },
  hudLeft: { gap: unit * 2 },
  dots: { flexDirection: "row", gap: unit * 1.5 },
  dot: {
    width: unit * 3,
    height: unit * 3,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.ink,
  },
  lives: { flexDirection: "row", gap: unit * 1.5, alignItems: "center" },
  seals: {
    flexDirection: "row",
    gap: unit * 4,
    height: 64,
    alignItems: "center",
  },
  countdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: unit * 4,
    marginBottom: unit * 4,
  },
  segments: {
    flex: 1,
    flexDirection: "row",
    gap: 3,
    padding: 3,
    backgroundColor: palette.ink,
  },
  segment: { flex: 1, height: unit * 3 },
  digits: { width: 44, alignItems: "flex-end" },
  prompt: { lineHeight: 24 },
  gap: { height: unit * 3 },
  input: {
    fontFamily: fonts.pixel,
    fontSize: 14,
    color: palette.text,
    paddingHorizontal: unit * 3,
    paddingVertical: unit * 4,
  },
  hint: { marginVertical: unit * 2 },
});
