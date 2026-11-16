import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export function haptic(kind: "tap" | "tick" | "success" = "tap") {
  if (Platform.OS === "web") return;
  const sent =
    kind === "success"
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : kind === "tick"
        ? Haptics.selectionAsync()
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  sent.catch(() => {});
}
