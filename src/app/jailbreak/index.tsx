import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DragonSprite } from "@/jailbreak/DragonSprite";
import { canonicalRoomCode } from "../../../convex/jailbreak/roomCode";
import { saveName, useJailbreakIdentity } from "@/jailbreak/identity";
import { ARENA_IMAGE, colors, PIXEL_FONT } from "@/jailbreak/theme";
import { PixelButton, PixelPanel, PixelText } from "@/jailbreak/ui";

function JoinForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState("DRAGON");
  const canEnter = name.trim().length > 0 && code.length > 0;

  async function enter() {
    if (!canEnter) return;
    await saveName(name.trim());
    router.push({ pathname: "/jailbreak/[code]", params: { code } });
  }

  return (
    <PixelPanel style={styles.panel}>
      <PixelText size={8} color={colors.gold}>Your knight name</PixelText>
      <TextInput
        testID="jb-name"
        accessibilityLabel="Knight name"
        value={name}
        onChangeText={setName}
        maxLength={16}
        placeholder="Sir Prompt-a-lot"
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        style={styles.input}
      />
      <PixelText size={8} color={colors.gold}>Room code</PixelText>
      <TextInput
        testID="jb-room"
        accessibilityLabel="Room code"
        value={code}
        onChangeText={(text) => setCode(canonicalRoomCode(text))}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={16}
        style={styles.input}
        returnKeyType="go"
        onSubmitEditing={enter}
      />
      <PixelText size={7} color={colors.muted} style={{ marginBottom: 10 }}>
        Share the code with friends. A new code opens a new arena, and you become its host.
      </PixelText>
      <View style={styles.notice}>
        <PixelText size={8} color={colors.ink}>
          Heads up: every knight in the room can open your strategy ledger and read every prompt you send, with the boss replies.
        </PixelText>
      </View>
      <PixelButton label="I understand · Enter arena" tone="ember" onPress={enter} disabled={!canEnter} testID="jb-enter" />
    </PixelPanel>
  );
}

export default function JailbreakLobby() {
  const identity = useJailbreakIdentity();

  return (
    <SafeAreaView style={styles.screen}>
      <Image source={ARENA_IMAGE} style={styles.bg} resizeMode="cover" />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <PixelButton
              label="◂ Back to app"
              size={8}
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
              testID="jb-back"
            />
          </View>
          <PixelText size={20} color={colors.ember} style={styles.title}>
            JAILBREAK BOSS
          </PixelText>
          <PixelText size={9} color={colors.parchment} style={styles.subtitle}>
            Talk the dragon into breaking its one rule.
          </PixelText>
          <DragonSprite anim="idle" animKey={0} scale={1.8} />
          {identity ? <JoinForm initialName={identity.name} /> : <ActivityIndicator color={colors.ember} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  bg: { position: "absolute", width: "100%", height: "100%", opacity: 0.25 },
  content: { alignItems: "center", padding: 16, gap: 8 },
  topRow: { alignSelf: "stretch", flexDirection: "row" },
  title: { textAlign: "center", marginTop: 8 },
  subtitle: { textAlign: "center" },
  panel: { width: "100%" },
  input: {
    fontFamily: PIXEL_FONT,
    fontSize: 12,
    color: colors.parchment,
    backgroundColor: colors.night,
    borderWidth: 3,
    borderColor: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  notice: {
    backgroundColor: colors.gold,
    borderWidth: 3,
    borderColor: colors.ink,
    padding: 8,
    marginBottom: 12,
  },
});
