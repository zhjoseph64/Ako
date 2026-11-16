import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";

import { colors, fonts, radii } from "./theme";

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDone, 1800);
    return () => clearTimeout(timer);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <Animated.View entering={FadeInDown} exiting={FadeOutDown} style={styles.toast} pointerEvents="none" testID="toast">
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.text,
  },
  text: { fontFamily: fonts.bold, fontSize: 14, color: colors.ctaText },
});
