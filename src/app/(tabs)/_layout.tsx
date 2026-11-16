import { router, usePathname } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { Easing } from "react-native";

import { duration, haptic, TabSwipe } from "@/motion";
import { TabIcon } from "@/platform/icons";
import { colors, fonts } from "@/platform/theme";

const ORDER = ["/", "/leaderboard", "/wallet", "/profile"] as const;

export default function TabsLayout() {
  const pathname = usePathname();
  return (
    <TabSwipe index={ORDER.indexOf(pathname as (typeof ORDER)[number])} count={ORDER.length} onChange={(index) => router.navigate(ORDER[index])}>
      <Tabs
        screenListeners={{ tabPress: () => haptic("tick") }}
        screenOptions={{
          headerShown: false,
          animation: "shift",
          transitionSpec: { animation: "timing", config: { duration: duration.base, easing: Easing.out(Easing.cubic) } },
          sceneStyle: { backgroundColor: colors.bg },
          tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.divider },
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: "Home", tabBarButtonTestID: "tab-home", tabBarIcon: (icon) => <TabIcon name="home" {...icon} /> }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{ title: "Ranks", tabBarButtonTestID: "tab-ranks", tabBarIcon: (icon) => <TabIcon name="ranks" {...icon} /> }}
        />
        <Tabs.Screen
          name="wallet"
          options={{ title: "Wallet", tabBarButtonTestID: "tab-wallet", tabBarIcon: (icon) => <TabIcon name="wallet" {...icon} /> }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: "Profile", tabBarButtonTestID: "tab-profile", tabBarIcon: (icon) => <TabIcon name="profile" {...icon} /> }}
        />
      </Tabs>
    </TabSwipe>
  );
}
