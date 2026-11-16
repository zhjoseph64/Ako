import { type ReactNode, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { GestureDetector, GestureHandlerRootView, usePanGesture } from "react-native-gesture-handler";
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { duration, easing, spring } from "@/motion";

export function Sheet({
  visible,
  onClose,
  label,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const offset = useSharedValue(height);
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      offset.set(withTiming(0, { duration: duration.slow, easing: easing.standard }));
    } else {
      offset.set(
        withTiming(height, { duration: duration.base, easing: easing.in }, (finished) => {
          if (finished) runOnJS(setMounted)(false);
        }),
      );
    }
  }, [visible, height, offset]);

  const drag = usePanGesture({
    activeOffsetY: 10,
    failOffsetX: [-24, 24],
    onUpdate: (event) => {
      "worklet";
      offset.set(Math.max(0, event.translationY));
    },
    onDeactivate: (event) => {
      "worklet";
      if (!event.canceled && (event.translationY > 110 || event.velocityY > 900)) runOnJS(onClose)();
      else offset.set(withSpring(0, spring.settle));
    },
  });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(offset.get(), [0, height * 0.6], [1, 0], "clamp") }));

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={`Close ${label}`} testID="sheet-backdrop" />
        <GestureDetector gesture={drag}>
          <Animated.View
            accessibilityLabel={label}
            style={[styles.sheet, { paddingBottom: Math.max(36, insets.bottom + 16) }, sheetStyle]}
          >
            <View style={styles.grabber} />
            {children}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(5,5,10,0.72)" },
  sheet: {
    backgroundColor: "#15151F",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: "#2A2840",
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 16,
  },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#3A3852" },
});
