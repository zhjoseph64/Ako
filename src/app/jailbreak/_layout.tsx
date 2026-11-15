import { PressStart2P_400Regular, useFonts } from "@expo-google-fonts/press-start-2p";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, Platform, View } from "react-native";

import { colors } from "@/jailbreak/theme";

export default function JailbreakLayout() {
  const [fontsLoaded] = useFonts({ PressStart2P_400Regular });

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const style = document.createElement("style");
    style.textContent = "#jailbreak-root img, #jailbreak-root div { image-rendering: pixelated; }";
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return (
    <View nativeID="jailbreak-root" style={{ flex: 1, backgroundColor: colors.night }}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      {fontsLoaded ? (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }} />
      ) : (
        <ActivityIndicator color={colors.ember} style={{ flex: 1 }} />
      )}
    </View>
  );
}
