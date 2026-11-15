import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useDeviceId } from "@/unpredictable/device";
import { Reveal } from "@/unpredictable/reveal";
import { colors } from "@/unpredictable/theme";

import { api } from "../../../convex/_generated/api";

const ROUND_MS = 15_000;

export default function Play() {
  const router = useRouter();
  const deviceId = useDeviceId();
  const data = useQuery(api.unpredictable.game.session, deviceId ? { deviceId } : "skip");
  const beginRound = useMutation(api.unpredictable.game.beginRound);
  const submit = useMutation(api.unpredictable.game.submit);

  const rounds = data?.session?.status === "ready" ? data.session.rounds : null;
  const [pinned, setPinned] = useState<number | null>(null);
  const firstOpen = rounds ? rounds.findIndex((r) => r.status !== "done") : -1;
  const cursor = pinned ?? (firstOpen === -1 ? null : firstOpen);
  const finished = rounds !== null && pinned === null && firstOpen === -1;
  const [answer, setAnswer] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(15);
  const [bar] = useState(() => new Animated.Value(1));
  const answerRef = useRef("");
  const sentFor = useRef<string | null>(null);

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
    void submit({ deviceId, roundId: id, answer: answerRef.current });
  };

  useEffect(() => {
    if (!open || !roundId || startedAt === null) return;
    const remaining = Math.max(0, Math.min(ROUND_MS, startedAt + ROUND_MS - Date.now()));
    bar.setValue(remaining / ROUND_MS);
    Animated.timing(bar, {
      toValue: 0,
      duration: remaining,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    const end = Date.now() + remaining;
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
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={styles.sealEmoji}>🔒</Text>
        <Text style={styles.sealTitle}>The AI is sealing its guesses</Text>
        <Text style={styles.dim}>Three for every prompt, locked before you see anything.</Text>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
      </SafeAreaView>
    );
  }

  const header = (
    <View style={styles.header}>
      <Text style={styles.kicker}>
        ROUND {round.index + 1} OF {rounds.length}
      </Text>
      <View style={styles.dots}>
        {rounds.map((r) => (
          <View
            key={r._id}
            style={[
              styles.dot,
              r.outcome === "escaped" && { backgroundColor: colors.win },
              r.outcome === "predicted" && { backgroundColor: colors.lose },
              r.outcome === "void" && { backgroundColor: colors.void },
              r.index === round.index && r.outcome === null && { backgroundColor: colors.text },
            ]}
          />
        ))}
      </View>
    </View>
  );

  if (round.status === "done" && round.reveal && round.outcome) {
    const last = cursor === rounds.length - 1;
    return (
      <SafeAreaView style={styles.screen}>
        {header}
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
          onNext={() => {
            if (last) return router.replace("/unpredictable/result");
            answerRef.current = "";
            setAnswer("");
            setSecondsLeft(15);
            setPinned(cursor! + 1);
          }}
        />
      </SafeAreaView>
    );
  }

  if (round.status === "sealed") {
    return (
      <SafeAreaView style={styles.screen}>
        {header}
        <View style={styles.center}>
          <Text style={styles.sealEmoji}>🔒 🔒 🔒</Text>
          <Text style={styles.sealTitle}>Three guesses are sealed</Text>
          <Text style={styles.dim}>You get 15 seconds and one to four words.</Text>
        </View>
        <Pressable
          testID="reveal-prompt"
          style={styles.button}
          onPress={() => {
            setPinned(cursor);
            void beginRound({ deviceId, roundId: round._id });
          }}
        >
          <Text style={styles.buttonText}>Show me the prompt</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (round.status === "judging") {
    return (
      <SafeAreaView style={styles.screen}>
        {header}
        <View style={styles.center}>
          <Text style={styles.promptSmall}>{round.prompt}</Text>
          <Text style={styles.bigAnswer}>“{round.answer}”</Text>
          <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
          <Text style={styles.dim}>Checking it against the sealed guesses…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
  const canSend = wordCount >= 1 && wordCount <= 4;

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {header}
        <View style={styles.timerTrack}>
          <Animated.View
            style={[
              styles.timerFill,
              secondsLeft <= 5 && { backgroundColor: colors.lose },
              { width: bar.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
            ]}
          />
        </View>
        <Text style={[styles.seconds, secondsLeft <= 5 && { color: colors.lose }]} testID="seconds-left">
          {secondsLeft}s
        </Text>
        <View style={styles.promptBox}>
          <Text style={styles.prompt} testID="prompt-text">
            {round.prompt}
          </Text>
        </View>
        <TextInput
          testID="answer-input"
          style={styles.input}
          value={answer}
          onChangeText={(text) => {
            answerRef.current = text;
            setAnswer(text);
          }}
          placeholder="One to four words"
          placeholderTextColor={colors.dim}
          autoFocus
          autoCorrect={false}
          maxLength={60}
          returnKeyType="send"
          onSubmitEditing={() => canSend && send(round._id)}
        />
        <Text style={[styles.dim, wordCount > 4 && { color: colors.lose }]}>
          {wordCount > 4 ? "Four words at most" : "No right answer. Just don't be obvious."}
        </Text>
        <Pressable
          testID="lock-in"
          style={[styles.button, styles.lockIn, !canSend && styles.buttonOff]}
          disabled={!canSend}
          onPress={() => send(round._id)}
        >
          <Text style={styles.buttonText}>Lock it in</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 24 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 1.5 },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  sealEmoji: { fontSize: 44 },
  sealTitle: { color: colors.text, fontSize: 24, fontWeight: "800", textAlign: "center" },
  dim: { color: colors.dim, fontSize: 15, textAlign: "center" },
  timerTrack: { height: 8, borderRadius: 4, backgroundColor: colors.card, overflow: "hidden" },
  timerFill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
  seconds: { color: colors.text, fontSize: 16, fontWeight: "800", textAlign: "right", marginTop: 6 },
  promptBox: { marginVertical: 20 },
  prompt: { color: colors.text, fontSize: 32, fontWeight: "800", lineHeight: 38 },
  promptSmall: { color: colors.dim, fontSize: 16, fontWeight: "600", textAlign: "center" },
  bigAnswer: { color: colors.text, fontSize: 32, fontWeight: "800", textAlign: "center" },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.accent,
    borderWidth: 2,
    borderRadius: 14,
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  button: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  lockIn: { marginTop: 16 },
  buttonOff: { opacity: 0.4 },
  buttonText: { color: "#0B0B12", fontSize: 18, fontWeight: "800" },
});
