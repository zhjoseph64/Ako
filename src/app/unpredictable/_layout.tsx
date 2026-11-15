import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { colors } from "@/unpredictable/theme";

export default function UnpredictableLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </>
  );
}
