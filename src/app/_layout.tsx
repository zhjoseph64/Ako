import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

import { WalletClaimer } from "@/cashout/credentials";
import { colors } from "@/platform/theme";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  return (
    <ConvexProvider client={convex}>
      <WalletClaimer />
      <StatusBar style="light" />
      {loaded ? (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="ranks" />
          <Stack.Screen name="unpredictable" options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="jailbreak" options={{ animation: "slide_from_bottom" }} />
        </Stack>
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.bg }} />
      )}
    </ConvexProvider>
  );
}
