import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, fonts, radii, space } from "./theme";

export function Screen({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <SafeAreaView edges={["top"]} style={styles.screen} testID={testID}>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
    </SafeAreaView>
  );
}

export function Heading({ children, size = 20, style }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.heading, { fontSize: size }, style]}>{children}</Text>;
}

export function Body({
  children,
  color = colors.secondary,
  size = 13,
  style,
  testID,
}: {
  children: ReactNode;
  color?: string;
  size?: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  return (
    <Text style={[{ fontFamily: fonts.medium, color, fontSize: size }, style]} testID={testID}>
      {children}
    </Text>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Avatar({ color, size = 44 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.page, paddingTop: 12, paddingBottom: 32, gap: 16 },
  heading: { fontFamily: fonts.heading, color: colors.text, letterSpacing: -0.3 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: 16,
    gap: 8,
  },
});
