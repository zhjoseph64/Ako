import { useMutation, useQuery } from "convex/react";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useDeviceId } from "@/unpredictable/device";
import { colors } from "@/unpredictable/theme";

import { api } from "../../../convex/_generated/api";

export default function UnpredictableHome() {
  const router = useRouter();
  const deviceId = useDeviceId();
  const data = useQuery(api.unpredictable.game.session, deviceId ? { deviceId } : "skip");
  const join = useMutation(api.unpredictable.game.join);
  const start = useMutation(api.unpredictable.game.start);
  const [typed, setName] = useState<string | null>(null);
  const name = typed ?? data?.name ?? "";
  const [busy, setBusy] = useState(false);

  const ready = deviceId !== null && data !== undefined && name.trim().length > 0 && !busy;

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
    <SafeAreaView style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>DAILY · 6 PROMPTS · 15 SECONDS EACH</Text>
        <Text style={styles.title}>Unpredictable</Text>
        <Text style={styles.body}>
          The AI seals three guesses for every prompt before you see it. Say something it
          didn&apos;t see coming.
        </Text>
      </View>
      <View style={styles.form}>
        <Text style={styles.label}>Your name</Text>
        <TextInput
          testID="name-input"
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Display name"
          placeholderTextColor={colors.dim}
          maxLength={20}
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => ready && play()}
        />
        <Pressable
          testID="play-button"
          style={[styles.button, !ready && styles.buttonOff]}
          disabled={!ready}
          onPress={play}
        >
          <Text style={styles.buttonText}>{busy ? "Starting…" : "Play today"}</Text>
        </Pressable>
        <Link href="/unpredictable/live" style={styles.link}>
          Live crowd view
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: "space-between" },
  hero: { marginTop: 48, gap: 12 },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 1.5 },
  title: { color: colors.text, fontSize: 44, fontWeight: "800", letterSpacing: -1 },
  body: { color: colors.dim, fontSize: 17, lineHeight: 24 },
  form: { gap: 12, marginBottom: 24 },
  label: { color: colors.dim, fontSize: 13, fontWeight: "600" },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    color: colors.text,
    fontSize: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  button: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  buttonOff: { opacity: 0.4 },
  buttonText: { color: "#0B0B12", fontSize: 18, fontWeight: "800" },
  link: { color: colors.dim, fontSize: 15, textAlign: "center", paddingVertical: 12 },
});
