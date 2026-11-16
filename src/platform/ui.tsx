import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { colors, fonts, radii, space } from "./theme";

export function Screen({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <SafeAreaView edges={["top"]} style={styles.screen} testID={testID}>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
    </SafeAreaView>
  );
}

export function TopBar({ title, right, fallback = "/" }: { title?: string; right?: ReactNode; fallback?: "/" | "/profile" }) {
  return (
    <View style={styles.topBar}>
      <Pressable
        onPress={() => (fallback === "/" ? router.navigate("/") : router.canGoBack() ? router.back() : router.replace(fallback))}
        accessibilityRole="button"
        accessibilityLabel={fallback === "/" ? "Back to home" : "Back"}
        style={styles.topBarButton}
        testID="top-back"
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M15 5l-7 7 7 7" />
        </Svg>
      </Pressable>
      {title && <Text style={styles.topBarTitle}>{title}</Text>}
      {title && (right ?? <View style={{ width: 44 }} />)}
    </View>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.page, paddingTop: 12, paddingBottom: 32, gap: 16 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  topBarButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topBarTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
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
