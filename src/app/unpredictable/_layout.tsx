import { PressStart2P_400Regular } from "@expo-google-fonts/press-start-2p";
import { VT323_400Regular } from "@expo-google-fonts/vt323";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

import { palette } from "@/unpredictable/theme";

export default function UnpredictableLayout() {
  const [loaded] = useFonts({ PressStart2P_400Regular, VT323_400Regular });
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      {loaded ? (
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
            contentStyle: { backgroundColor: palette.bg },
          }}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: palette.bg }} />
      )}
    </>
  );
}
