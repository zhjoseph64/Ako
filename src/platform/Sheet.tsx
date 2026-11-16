import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={`Close ${label}`} testID="sheet-backdrop" />
        <Animated.View
          entering={FadeInDown.duration(320).easing(Easing.bezier(0.2, 0.8, 0.2, 1))}
          accessibilityLabel={label}
          style={[styles.sheet, { paddingBottom: Math.max(36, insets.bottom + 16) }]}
        >
          <View style={styles.grabber} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(5,5,10,0.72)", justifyContent: "flex-end" },
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
