import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { useDeviceId } from "@/unpredictable/device";
import { Opponent } from "@/unpredictable/sprite";
import { fonts, palette, unit } from "@/unpredictable/theme";
import {
  BackLink,
  Blink,
  Body,
  Display,
  PixelBox,
  PixelButton,
  Screen,
} from "@/unpredictable/ui";

import { api } from "../../../convex/_generated/api";

const RULES = [
  "6 prompts a day. same for everyone.",
  "the AI seals 3 guesses before you see one.",
  "15 seconds. one to four words.",
  "say what it didn't see coming.",
];

export default function UnpredictableHome() {
  const router = useRouter();
  const deviceId = useDeviceId();
  const data = useQuery(
    api.unpredictable.game.session,
    deviceId ? { deviceId } : "skip",
  );
  const join = useMutation(api.unpredictable.game.join);
  const start = useMutation(api.unpredictable.game.start);
  const [typed, setName] = useState<string | null>(null);
  const name = typed ?? data?.name ?? "";
  const [busy, setBusy] = useState(false);

  const ready =
    deviceId !== null && data !== undefined && name.trim().length > 0 && !busy;

  const play = async () => {
    if (!deviceId) return;
    setBusy(true);
    try {
      await join({ deviceId, name });
      await start({ deviceId });
      router.push("/unpredictable/play");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <BackLink onPress={() => router.back()} />
        <View style={styles.hero}>
          <Opponent mood="idle" scale={9} />
          <Display size={20} style={styles.title}>
            UNPREDICTABLE
          </Display>
          <Display size={9} color={palette.cyan} style={styles.sub}>
            THE DAILY DUEL
          </Display>
        </View>
        <PixelBox>
          <Body color={palette.cyan} size={20}>
            how to play
          </Body>
          {RULES.map((rule) => (
            <Body key={rule} color={palette.dim} size={21}>
              {"· " + rule}
            </Body>
          ))}
        </PixelBox>
        <View style={styles.form}>
          <PixelBox pad={0} color={palette.cyan}>
            <TextInput
              testID="name-input"
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="YOUR NAME"
              placeholderTextColor={palette.dim}
              maxLength={20}
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={() => ready && play()}
            />
          </PixelBox>
          <PixelButton
            testID="play-button"
            label={busy ? "LOADING..." : "▼ START DUEL ▼"}
            disabled={!ready}
            onPress={play}
          />
          <Pressable
            testID="live-link"
            accessibilityRole="link"
            accessibilityLabel="Live room"
            style={styles.liveRow}
            onPress={() => router.push("/unpredictable/live")}
          >
            <Blink>
              <View style={styles.liveDot} />
            </Blink>
            <Body color={palette.text} size={24} style={styles.underline}>
              LIVE ROOM
            </Body>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1, padding: unit * 5, justifyContent: "space-between" },
  hero: { alignItems: "center", gap: unit * 3 },
  title: {
    textAlign: "center",
    textShadowColor: palette.cyan,
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },
  sub: { letterSpacing: 4 },
  form: { gap: unit * 3 },
  input: {
    fontFamily: fonts.body,
    fontSize: 28,
    color: palette.text,
    paddingHorizontal: unit * 3,
    paddingVertical: unit * 3,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: unit * 2,
  },
  liveDot: { width: unit * 2, height: unit * 2, backgroundColor: palette.pink },
  underline: { textDecorationLine: "underline" },
});
