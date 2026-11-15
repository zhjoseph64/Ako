import { useMutation } from "convex/react";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { colors, PIXEL_FONT } from "./theme";
import { PixelButton, PixelPanel, PixelText } from "./ui";

export function SetupModal({
  room,
  playerId,
  isHost,
  onClose,
}: {
  room: Doc<"jbRooms">;
  playerId: string;
  isHost: boolean;
  onClose: () => void;
}) {
  const updateSetup = useMutation(api.jailbreak.rooms.updateSetup);
  const newRound = useMutation(api.jailbreak.rooms.newRound);
  const [form, setForm] = useState({
    bossName: room.bossName,
    instruction: room.instruction,
    targetDescription: room.targetDescription,
    allowedReply: room.allowedReply,
    winCheckType: room.winCheckType,
    winCheck: room.winCheck,
  });
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setError(null);
    try {
      await updateSetup({ roomId: room._id, playerId, ...form });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^.*Uncaught Error: /s, "").split("\n")[0] : "Could not save");
    }
  }

  const field = (label: string, key: keyof typeof form, multiline = false, hint?: string) => (
    <View style={styles.field}>
      <PixelText size={8} color={colors.gold}>{label}</PixelText>
      {hint && <PixelText size={7} color={colors.muted}>{hint}</PixelText>}
      <TextInput
        testID={`setup-${key}`}
        editable={isHost}
        value={form[key]}
        onChangeText={set(key)}
        multiline={multiline}
        style={[styles.input, multiline && { minHeight: 70, textAlignVertical: "top" }]}
        placeholderTextColor={colors.muted}
      />
    </View>
  );

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <PixelPanel style={styles.sheet}>
          <ScrollView>
            <PixelText size={12} color={colors.parchment} style={{ marginBottom: 4 }}>
              Boss setup
            </PixelText>
            <PixelText size={7} color={colors.muted} style={{ marginBottom: 10 }}>
              {isHost
                ? "Saving starts a new round: the boss revives and every knight returns to ring 2. Past attacks stay in the ledgers."
                : "Only the room host can change the boss. You can read the rules here."}
            </PixelText>
            {field("Boss name", "bossName")}
            {field("Boss instruction (system prompt)", "instruction", true)}
            {field("Forbidden behavior / target", "targetDescription", false, "Shown to players as the goal.")}
            {field("Rule-held reply (optional)", "allowedReply", false, "Exact reply that counts as the rule holding. Anything else that isn't a refusal is a partial break.")}
            <View style={styles.field}>
              <PixelText size={8} color={colors.gold}>Win check</PixelText>
              <View style={styles.row}>
                <PixelButton
                  label="Exact answer"
                  tone={form.winCheckType === "exact" ? "gold" : "stone"}
                  size={8}
                  disabled={!isHost}
                  onPress={() => setForm((f) => ({ ...f, winCheckType: "exact" }))}
                />
                <PixelButton
                  label="Regex"
                  tone={form.winCheckType === "regex" ? "gold" : "stone"}
                  size={8}
                  disabled={!isHost}
                  onPress={() => setForm((f) => ({ ...f, winCheckType: "regex" }))}
                />
              </View>
              <PixelText size={7} color={colors.muted}>
                {form.winCheckType === "exact"
                  ? "Full break when the reply equals this (ignoring case, quotes and end punctuation)."
                  : "Full break when the reply matches. Use /pattern/i for flags."}
              </PixelText>
              <TextInput
                testID="setup-winCheck"
                editable={isHost}
                value={form.winCheck}
                onChangeText={set("winCheck")}
                style={styles.input}
              />
            </View>
            {error && <PixelText size={8} color={colors.held} style={{ marginBottom: 8 }}>{error}</PixelText>}
            <View style={[styles.row, { flexWrap: "wrap", marginTop: 6 }]}>
              {isHost && <PixelButton label="Save + new round" tone="ember" onPress={save} size={9} testID="setup-save" />}
              {isHost && (
                <PixelButton
                  label="Revive boss"
                  tone="rune"
                  size={9}
                  onPress={async () => {
                    await newRound({ roomId: room._id, playerId });
                    onClose();
                  }}
                />
              )}
              <PixelButton label="Close" onPress={onClose} size={9} />
            </View>
          </ScrollView>
        </PixelPanel>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10,6,12,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  sheet: { width: "100%", maxWidth: 560, maxHeight: "92%" },
  field: { marginBottom: 10, gap: 4 },
  row: { flexDirection: "row", gap: 8 },
  input: {
    fontFamily: PIXEL_FONT,
    fontSize: 10,
    lineHeight: 16,
    color: colors.parchment,
    backgroundColor: colors.night,
    borderWidth: 3,
    borderColor: colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
});
