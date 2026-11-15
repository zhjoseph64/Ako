import { router } from "expo-router";
import { useState } from "react";
import { Image, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DragonSprite } from "@/jailbreak/DragonSprite";
import { getSavedName, saveName } from "@/jailbreak/identity";
import { ARENA_IMAGE, colors, PIXEL_FONT } from "@/jailbreak/theme";
import { PixelButton, PixelPanel, PixelText } from "@/jailbreak/ui";

export default function JailbreakLobby() {
  const [name, setName] = useState(getSavedName());
  const [code, setCode] = useState("DRAGON");
  const canEnter = name.trim().length > 0 && code.trim().length > 0;

  function enter() {
    if (!canEnter) return;
    saveName(name.trim());
    router.push({ pathname: "/jailbreak/[code]", params: { code: code.trim().toUpperCase() } });
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Image source={ARENA_IMAGE} style={styles.bg} resizeMode="cover" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <PixelButton label="◂ Back to app" size={8} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} testID="jb-back" />
        </View>
        <PixelText size={22} color={colors.ember} style={styles.title}>
          JAILBREAK BOSS
        </PixelText>
        <PixelText size={9} color={colors.parchment} style={styles.subtitle}>
          Talk the dragon into breaking its one rule.
        </PixelText>
        <View style={styles.dragon}>
          <DragonSprite anim="idle" animKey={0} scale={2} />
        </View>
        <PixelPanel style={styles.panel}>
          <PixelText size={8} color={colors.gold}>Your knight name</PixelText>
          <TextInput
            testID="jb-name"
            value={name}
            onChangeText={setName}
            maxLength={16}
            placeholder="Sir Prompt-a-lot"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <PixelText size={8} color={colors.gold}>Room code</PixelText>
          <TextInput
            testID="jb-room"
            value={code}
            onChangeText={(text) => setCode(text.toUpperCase())}
            autoCapitalize="characters"
            maxLength={16}
            style={styles.input}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  bg: { position: "absolute", width: "100%", height: "100%", opacity: 0.25 },
  content: { alignItems: "center", padding: 16, gap: 8 },
  topRow: { alignSelf: "stretch", flexDirection: "row" },
  title: { textAlign: "center", marginTop: 12 },
  subtitle: { textAlign: "center" },
  dragon: { marginVertical: 4 },
  panel: { width: "100%", maxWidth: 460 },
  input: {
    fontFamily: PIXEL_FONT,
    fontSize: 12,
    color: colors.parchment,
    backgroundColor: colors.night,
    borderWidth: 3,
    borderColor: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 10,
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
