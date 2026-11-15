import { useQuery } from "convex/react";
import { Fragment } from "react";
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { ringLabel } from "./geometry";
import { colors, KNIGHT_SKINS, outcomeColor } from "./theme";
import { PixelButton, PixelPanel, PixelText } from "./ui";

export function LedgerModal({
  roomId,
  player,
  isMe,
  onClose,
}: {
  roomId: Id<"jbRooms">;
  player: Doc<"jbPlayers">;
  isMe: boolean;
  onClose: () => void;
}) {
  const entries = useQuery(api.jailbreak.rooms.ledger, { roomId, playerId: player.playerId });

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <PixelPanel tone="parchment" style={styles.sheet}>
          <View style={styles.header}>
            <Image source={KNIGHT_SKINS[player.slot % KNIGHT_SKINS.length]} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <PixelText size={12} color={colors.ink}>
                {`${player.name}${isMe ? " (you)" : ""}`}
              </PixelText>
              <PixelText size={8} color="#6a5340">
                {`Strategy ledger · ${ringLabel(player.ring)} · read-only`}
              </PixelText>
            </View>
            <PixelButton label="Close" onPress={onClose} size={9} testID="ledger-close" />
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 8 }}>
            {entries === undefined ? (
              <ActivityIndicator color={colors.ink} style={{ margin: 24 }} />
            ) : entries.length === 0 ? (
              <PixelText size={9} color="#6a5340" style={{ textAlign: "center", margin: 24 }}>
                No attacks yet.
              </PixelText>
            ) : (
              entries.map((entry, index) => {
                const previous = entries[index - 1];
                const divider =
                  previous && previous.round !== entry.round
                    ? "New round"
                    : previous && previous.chatEpoch !== entry.chatEpoch
                      ? "AI chat reset"
                      : null;
                return (
                  <Fragment key={entry._id}>
                    {divider && (
                      <View style={styles.divider}>
                        <PixelText size={8} color="#8a6a48">{`— ${divider} —`}</PixelText>
                      </View>
                    )}
                    <View style={styles.entry} testID="ledger-entry">
                      <View style={styles.entryHead}>
                        <PixelText size={9} color={colors.ink}>{`#${index + 1}`}</PixelText>
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: entry.outcome ? outcomeColor[entry.outcome] : colors.muted },
                          ]}
                        >
                          <PixelText size={7} color={colors.ink}>
                            {entry.status === "pending" ? "IN FLIGHT" : (entry.label ?? "ERROR")}
                          </PixelText>
                        </View>
                        {entry.ringAfter !== undefined && entry.status === "resolved" && (
                          <PixelText size={7} color="#6a5340">
                            {`${ringLabel(entry.ringBefore)} → ${ringLabel(entry.ringAfter)}`}
                          </PixelText>
                        )}
                      </View>
                      <PixelText size={7} color="#8a6a48">PROMPT</PixelText>
                      <PixelText size={9} color={colors.ink} style={styles.body}>{entry.prompt}</PixelText>
                      <PixelText size={7} color="#8a6a48">BOSS REPLY</PixelText>
                      <PixelText size={9} color="#7a2a10" style={styles.body}>
                        {entry.reply ?? "…"}
                      </PixelText>
                    </View>
                  </Fragment>
                );
              })
            )}
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
  sheet: { width: "100%", maxWidth: 620, maxHeight: "90%" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  avatar: { width: 44, height: 55 },
  scroll: { flexGrow: 0 },
  divider: { alignItems: "center", marginVertical: 8 },
  entry: {
    borderWidth: 3,
    borderColor: colors.parchmentDark,
    backgroundColor: "#fbf3dc",
    padding: 8,
    marginBottom: 8,
  },
  entryHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" },
  badge: { borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 4, paddingVertical: 1 },
  body: { marginBottom: 6 },
});
