import { Tabs } from "expo-router/js-tabs";

import { TabIcon } from "@/platform/icons";
import { colors, fonts } from "@/platform/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.divider },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarButtonTestID: "tab-home", tabBarIcon: ({ color }) => <TabIcon name="home" color={color} /> }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{ title: "Ranks", tabBarButtonTestID: "tab-ranks", tabBarIcon: ({ color }) => <TabIcon name="ranks" color={color} /> }}
      />
      <Tabs.Screen
        name="wallet"
        options={{ title: "Wallet", tabBarButtonTestID: "tab-wallet", tabBarIcon: ({ color }) => <TabIcon name="wallet" color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarButtonTestID: "tab-profile", tabBarIcon: ({ color }) => <TabIcon name="profile" color={color} /> }}
      />
    </Tabs>
  );
}
