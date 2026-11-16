import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { useDeviceId } from "@/unpredictable/device";
import { Heart, Opponent } from "@/unpredictable/sprite";
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
  "the squid seals 3 guesses before you see each prompt.",
  "you have 15 seconds to answer.",
  "say something it didn't see coming.",
  "every time it predicts you, you lose a life.",
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
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(
      ios ? "keyboardWillShow" : "keyboardDidShow",
      () => setTyping(true),
    );
    const hide = Keyboard.addListener(
      ios ? "keyboardWillHide" : "keyboardDidHide",
      () => setTyping(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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
          <Opponent mood="idle" scale={5} />
          <Display size={19} style={styles.title}>
            UNPREDICTABLE
          </Display>
          <Display size={9} color={palette.cyan}>
            OUTSMART THE SQUID
          </Display>
        </View>
        {!typing && (
          <PixelBox>
            <View style={styles.rulesHead}>
              <Body color={palette.gold}>HOW TO PLAY</Body>
              <View style={styles.hearts}>
                {[0, 1, 2].map((i) => (
                  <Heart key={i} full />
                ))}
              </View>
            </View>
            {RULES.map((rule) => (
              <Body key={rule} color={palette.dim} size={9} style={styles.rule}>
                {"· " + rule}
              </Body>
            ))}
          </PixelBox>
        )}
        <View style={styles.form}>
          <PixelBox pad={0} color={palette.cyan} fill={palette.deep}>
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
            label={busy ? "DIVING..." : "▼ DIVE IN ▼"}
            disabled={!ready}
            onPress={play}
          />
          {!typing && (
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
              <Body style={styles.underline}>LIVE ROOM</Body>
            </Pressable>
          )}
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
    color: palette.text,
    textShadowColor: palette.cyanDark,
    textShadowRadius: 0,
    textShadowOffset: { width: 3, height: 3 },
  },
  rulesHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hearts: { flexDirection: "row", gap: unit },
  rule: { marginTop: unit * 1.5 },
  form: { gap: unit * 3 },
  input: {
    fontFamily: fonts.pixel,
    fontSize: 13,
    color: palette.text,
    paddingHorizontal: unit * 3,
    paddingVertical: unit * 4,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: unit * 2,
    paddingVertical: unit * 2,
  },
  liveDot: { width: unit * 2, height: unit * 2, backgroundColor: palette.pink },
  underline: { textDecorationLine: "underline" },
});
