import { type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors, PIXEL_FONT } from "./theme";

export function PixelText({
  children,
  style,
  size = 10,
  color = colors.parchment,
  numberOfLines,
  testID,
}: {
  testID?: string;
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  size?: number;
  color?: string;
  numberOfLines?: number;
}) {
  return (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      style={[{ fontFamily: PIXEL_FONT, fontSize: size, lineHeight: size * 1.6, color }, style]}
    >
      {children}
    </Text>
  );
}

const BUTTON_TONES = {
  ember: { face: colors.ember, shade: "#a34a08", text: colors.ink },
  stone: { face: colors.stoneLight, shade: colors.stone, text: colors.parchment },
  rune: { face: colors.rune, shade: "#1f6f99", text: colors.ink },
  gold: { face: colors.gold, shade: "#9a6b10", text: colors.ink },
} as const;

export function PixelButton({
  label,
  onPress,
  tone = "stone",
  disabled,
  size = 10,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  tone?: keyof typeof BUTTON_TONES;
  disabled?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const palette = BUTTON_TONES[tone];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.face,
          borderBottomColor: palette.shade,
          borderRightColor: palette.shade,
          opacity: disabled ? 0.45 : 1,
          transform: [{ translateY: pressed ? 2 : 0 }],
        },
        style,
      ]}
    >
      <PixelText size={size} color={palette.text} style={styles.buttonText}>
        {label}
      </PixelText>
    </Pressable>
  );
}

export function PixelPanel({
  children,
  style,
  tone = "stone",
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: "stone" | "parchment";
}) {
  const parchment = tone === "parchment";
  return (
    <View style={[styles.panelOuter, style]}>
      <View
        style={[
          styles.panelInner,
          parchment && { backgroundColor: colors.parchment, borderColor: colors.parchmentDark },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function SpeechBubble({
  text,
  maxWidth,
  size = 9,
  tone = "parchment",
  numberOfLines = 4,
}: {
  text: string;
  maxWidth: number;
  size?: number;
  tone?: "parchment" | "ember" | "rune";
  numberOfLines?: number;
}) {
  const background =
    tone === "ember" ? "#ffd9a8" : tone === "rune" ? "#d6f4ff" : colors.parchment;
  return (
    <View style={{ alignItems: "center", maxWidth }}>
      <View style={[styles.bubble, { backgroundColor: background }]}>
        <PixelText size={size} color={colors.ink} numberOfLines={numberOfLines}>
          {text}
        </PixelText>
      </View>
      <View style={[styles.tailA, { backgroundColor: background }]} />
      <View style={[styles.tailB, { backgroundColor: colors.ink }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 3,
    borderColor: colors.ink,
    borderBottomWidth: 6,
    borderRightWidth: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { textAlign: "center" },
  panelOuter: { borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.ink },
  panelInner: {
    borderWidth: 3,
    borderColor: colors.stoneEdge,
    backgroundColor: colors.stone,
    padding: 10,
  },
  bubble: {
    borderWidth: 3,
    borderColor: colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  tailA: {
    width: 10,
    height: 6,
    marginTop: -3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.ink,
  },
  tailB: { width: 4, height: 4 },
});
