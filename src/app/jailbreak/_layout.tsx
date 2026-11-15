import { PressStart2P_400Regular, useFonts } from "@expo-google-fonts/press-start-2p";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";

import { colors } from "@/jailbreak/theme";

export default function JailbreakLayout() {
  const [fontsLoaded] = useFonts({ PressStart2P_400Regular });

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
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
