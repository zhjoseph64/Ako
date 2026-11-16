import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../../../convex/_generated/api";
import { canonicalRoomCode } from "../../../convex/jailbreak/roomCode";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Arena } from "@/jailbreak/Arena";
import { ringLabel } from "@/jailbreak/geometry";
import { newAttackId, useJailbreakIdentity, type JailbreakIdentity } from "@/jailbreak/identity";
import { LedgerModal } from "@/jailbreak/LedgerModal";
import { SetupModal } from "@/jailbreak/SetupModal";
import { colors, outcomeColor, PIXEL_FONT } from "@/jailbreak/theme";
import { PixelButton, PixelPanel, PixelText } from "@/jailbreak/ui";
import { useDirector } from "@/jailbreak/useDirector";
import { VictoryOverlay } from "@/jailbreak/VictoryOverlay";

const ACTIVE_MS = 90_000;
const PROMPT_FONT = 11;
const PROMPT_LINE = 17;
const PROMPT_PADDING = 26;
const PROMPT_MAX_HEIGHT = PROMPT_PADDING + 5 * PROMPT_LINE;

function wrappedLines(text: string, width: number) {
  const perLine = Math.max(1, Math.floor(width / PROMPT_FONT));
  let lines = 1;
  let used = 0;
  for (const word of text.split(" ")) {
    const length = word.length + (used > 0 ? 1 : 0);
    if (used + length <= perLine) {
      used += length;
      continue;
    }
    lines += used > 0 ? 1 : 0;
    lines += Math.floor(Math.max(0, word.length - 1) / perLine);
    used = word.length % perLine || perLine;
  }
  return lines;
}

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^[\s\S]*Uncaught Error: /, "").split("\n")[0];
}

export default function JailbreakArena() {
  const identity = useJailbreakIdentity();
  if (!identity) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.ember} />
      </SafeAreaView>
    );
  }
  return <ArenaScreen identity={identity} />;
}

function ArenaScreen({ identity }: { identity: JailbreakIdentity }) {
  const { playerId, secret, name } = identity;
  const { code } = useLocalSearchParams<{ code: string }>();
  const roomCode = canonicalRoomCode(code ?? "");

  const joinRoom = useMutation(api.jailbreak.rooms.joinRoom);
  const heartbeat = useMutation(api.jailbreak.rooms.heartbeat);
  const submitAttack = useMutation(api.jailbreak.rooms.submitAttack);
  const resetChat = useMutation(api.jailbreak.rooms.resetChat);
  const newRound = useMutation(api.jailbreak.rooms.newRound);

  const data = useQuery(api.jailbreak.rooms.getRoom, { code: roomCode });
  const roomId = data?.room._id;
  const attacks = useQuery(api.jailbreak.rooms.recentAttacks, roomId ? { roomId } : "skip");
  const myLedger = useQuery(api.jailbreak.rooms.ledger, roomId ? { roomId, playerId } : "skip");
  const director = useDirector(attacks, data?.room);

  const [joinError, setJoinError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [promptWidth, setPromptWidth] = useState(0);
  const promptHeight = Math.min(PROMPT_MAX_HEIGHT, PROMPT_PADDING + wrappedLines(prompt, promptWidth - PROMPT_PADDING) * PROMPT_LINE);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "bad"; key: number } | null>(null);
  const [ledgerFor, setLedgerFor] = useState<Doc<"jbPlayers"> | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const pendingSend = useRef<{ id: string; prompt: string } | null>(null);

  useEffect(() => {
    if (!roomCode) return;
    joinRoom({ code: roomCode, playerId, secret, name: name || undefined }).catch((e) =>
      setJoinError(errorText(e)),
    );
  }, [joinRoom, playerId, secret, roomCode, name]);

  useEffect(() => {
    if (!roomId) return;
    const interval = setInterval(() => {
      heartbeat({ roomId, playerId, secret }).catch(() => {});
      setNow(Date.now());
    }, 20_000);
    return () => clearInterval(interval);
  }, [heartbeat, playerId, secret, roomId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  if (joinError) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <PixelText size={10} color={colors.held}>{joinError}</PixelText>
        <PixelButton label="◂ Lobby" onPress={() => router.replace("/jailbreak")} />
      </SafeAreaView>
    );
  }
  if (!data) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.ember} />
        <PixelText size={9}>Opening the arena gates…</PixelText>
      </SafeAreaView>
    );
  }

  const { room, players, model, winningAttack } = data;
  const me = players.find((p) => p.playerId === playerId);
  const visiblePlayers = players.filter((p) => p.playerId === playerId || now - p.lastSeen < ACTIVE_MS);
  const isHost = room.hostId === playerId;
  const myLast = myLedger?.at(-1);
  const inFlight = myLast?.status === "pending" || sending;
  const defeated = room.status === "defeated";
  const latestReply =
    myLast && myLast.round === room.round && myLast.status !== "pending" && director.hasReacted(myLast._id)
      ? myLast
      : undefined;
  const chatWasReset = me && latestReply && latestReply.chatEpoch !== me.chatEpoch;
  const chatNumber = (me?.chatEpoch ?? 0) + 1;

  async function send() {
    const text = prompt.trim();
    if (!text || inFlight || defeated || !roomId) return;
    const attempt = pendingSend.current?.prompt === text ? pendingSend.current : { id: newAttackId(), prompt: text };
    pendingSend.current = attempt;
    setSending(true);
    try {
      await submitAttack({ roomId, playerId, secret, clientAttackId: attempt.id, prompt: text });
      pendingSend.current = null;
      setPrompt("");
    } catch (e) {
      setToast({ text: errorText(e), tone: "bad", key: Date.now() });
    } finally {
      setSending(false);
    }
  }

  async function playAgain() {
    if (!roomId) return;
    try {
      await newRound({ roomId, playerId, secret });
    } catch (e) {
      setToast({ text: errorText(e), tone: "bad", key: Date.now() });
    }
  }

  const showVictory = defeated && director.defeatShown;

  async function reset() {
    if (!roomId) return;
    try {
      const epoch = await resetChat({ roomId, playerId, secret });
      setToast({ text: `AI chat reset. Fresh conversation #${epoch + 1}: the boss forgot your earlier prompts.`, tone: "ok", key: Date.now() });
    } catch (e) {
      setToast({ text: errorText(e), tone: "bad", key: Date.now() });
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <View style={styles.hud}>
        <PixelButton label="◂ App" size={8} onPress={() => router.dismissTo("/")} testID="jb-exit" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <PixelText size={10} color={colors.ember} numberOfLines={1}>
            {room.bossName}
          </PixelText>
          <PixelText size={7} color={colors.muted} numberOfLines={1}>
            {`Room ${room.code} · ${visiblePlayers.length} knight${visiblePlayers.length === 1 ? "" : "s"}`}
          </PixelText>
        </View>
        <PixelButton label={isHost ? "Setup" : "Rules"} size={8} tone="stone" onPress={() => setSetupOpen(true)} testID="jb-setup" />
      </View>
      <View style={styles.goalRow}>
        <PixelText size={7} color={colors.parchment} style={{ flex: 1 }} numberOfLines={2}>
          {`Goal: ${room.targetDescription}`}
        </PixelText>
        <View style={styles.adapter} testID="jb-adapter">
          <PixelText size={7} color={colors.ink} numberOfLines={1}>
            {`MODEL · ${model}`}
          </PixelText>
        </View>
      </View>

      <View
        style={styles.stageWrap}
        onLayout={(e) => setStage({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      >
        {stage.width > 0 && (
          <Arena
            players={visiblePlayers}
            myId={playerId}
            width={stage.width}
            height={stage.height}
            director={director}
            winnerName={room.winnerName}
            onSelectPlayer={setLedgerFor}
          />
        )}
      </View>

      <View style={styles.bottom}>
        <PixelPanel style={styles.response}>
          <View style={styles.responseHead}>
            <PixelText size={7} color={colors.gold}>{`BOSS → YOU · CHAT #${chatNumber}`}</PixelText>
            {me && <PixelText size={7} color={colors.muted}>{ringLabel(me.ring)}</PixelText>}
            {latestReply?.label && !chatWasReset && (
              <View style={[styles.tag, { backgroundColor: latestReply.outcome ? outcomeColor[latestReply.outcome] : colors.muted }]}>
                <PixelText size={7} color={colors.ink}>{latestReply.label}</PixelText>
              </View>
            )}
          </View>
          <ScrollView style={styles.replyScroll} nestedScrollEnabled>
          <PixelText size={9} color={colors.parchment} testID="jb-reply">
            {defeated
              ? `The boss is defeated. ${room.winnerName ?? "A knight"} wins this round.`
              : inFlight
                ? "Your attack is in flight…"
                : latestReply && !chatWasReset
                  ? latestReply.reply
                  : myLast && myLast.round !== room.round
                    ? "New round. The boss remembers none of your earlier prompts."
                    : chatWasReset || (myLast && me && myLast.chatEpoch !== me.chatEpoch)
                      ? "AI chat reset. The boss no longer remembers your earlier prompts."
                      : myLast
                        ? "The dragon is answering…"
                        : "Type a prompt and send it at the dragon. Tap any knight to read their strategy ledger."}
          </PixelText>
          </ScrollView>
        </PixelPanel>
        <View style={styles.inputRow}>
          <TextInput
            testID="jb-prompt"
            accessibilityLabel="Jailbreak prompt"
            value={prompt}
            onChangeText={setPrompt}
            onSubmitEditing={send}
            submitBehavior="blurAndSubmit"
            onKeyPress={(e) => {
              const key = e.nativeEvent as { key: string; shiftKey?: boolean };
              if (Platform.OS !== "web" || key.key !== "Enter" || key.shiftKey) return;
              e.preventDefault();
              send();
            }}
            multiline
            scrollEnabled={promptHeight >= PROMPT_MAX_HEIGHT}
            onLayout={(e) => setPromptWidth(e.nativeEvent.layout.width)}
            placeholder={defeated ? "Boss defeated" : "Whisper your jailbreak…"}
            placeholderTextColor={colors.muted}
            editable={!defeated}
            maxLength={1000}
            style={[styles.input, { height: promptHeight }]}
            returnKeyType="send"
            autoCorrect={false}
            spellCheck={false}
            autoCapitalize="none"
          />
          <PixelButton
            label={inFlight ? "…" : "Send"}
            tone="ember"
            onPress={send}
            disabled={inFlight || defeated || !prompt.trim()}
            testID="jb-send"
          />
        </View>
        <View style={styles.resetRow}>
          <PixelButton label="Reset AI chat" tone="rune" size={8} onPress={reset} disabled={inFlight} testID="jb-reset" />
          <PixelText size={6} color={colors.muted} style={{ flex: 1 }}>
            Your prompts are visible to this room. Reset clears only your AI chat; position and history stay.
          </PixelText>
        </View>
      </View>

      {toast && (
        <View pointerEvents="none" style={styles.toastWrap}>
          <View style={[styles.toast, { borderColor: toast.tone === "ok" ? colors.rune : colors.held }]}>
            <PixelText size={8} color={toast.tone === "ok" ? colors.rune : colors.held} testID="jb-toast">
              {toast.text}
            </PixelText>
          </View>
        </View>
      )}

      {showVictory && (
        <VictoryOverlay
          key={room.round}
          room={room}
          winningAttack={winningAttack}
          model={model}
          myId={playerId}
          celebrate={director.dragon.anim === "defeat"}
          onPlayAgain={playAgain}
          onBack={() => router.dismissTo("/")}
          onReadLedger={() => {
            const winner = players.find((p) => p.playerId === room.winnerId);
            if (winner) setLedgerFor(winner);
          }}
        />
      )}

      {ledgerFor && roomId && (
        <LedgerModal
          roomId={roomId as Id<"jbRooms">}
          player={players.find((p) => p._id === ledgerFor._id) ?? ledgerFor}
          isMe={ledgerFor.playerId === playerId}
          onClose={() => setLedgerFor(null)}
        />
      )}
      {setupOpen && <SetupModal room={room} identity={identity} isHost={isHost} onClose={() => setSetupOpen(false)} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  center: { alignItems: "center", justifyContent: "center", gap: 12 },
  hud: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 3,
    borderBottomColor: colors.ink,
    backgroundColor: colors.stone,
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.night,
    borderBottomWidth: 3,
    borderBottomColor: colors.ink,
  },
  resetRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  adapter: {
    backgroundColor: colors.full,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingHorizontal: 6,
    paddingVertical: 3,
    maxWidth: 170,
  },
  stageWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#120a10" },
  bottom: {
    padding: 10,
    gap: 6,
    backgroundColor: colors.stone,
    borderTopWidth: 3,
    borderTopColor: colors.ink,
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
  },
  response: { minHeight: 64 },
  replyScroll: { maxHeight: 96 },
  responseHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" },
  tag: { borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 4 },
  inputRow: { flexDirection: "row", gap: 6, alignItems: "flex-end" },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: PIXEL_FONT,
    fontSize: PROMPT_FONT,
    color: colors.parchment,
    backgroundColor: colors.night,
    borderWidth: 3,
    borderColor: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 10,
    lineHeight: PROMPT_LINE,
    textAlignVertical: "top",
  },
  toastWrap: { position: "absolute", top: 70, left: 0, right: 0, alignItems: "center", paddingHorizontal: 16 },
  toast: { backgroundColor: colors.ink, borderWidth: 3, padding: 10, maxWidth: 520 },
});
