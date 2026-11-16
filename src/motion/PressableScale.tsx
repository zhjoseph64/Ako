import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { haptic } from "./haptics";
import { duration, spring } from "./tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
  style,
  scale = 0.96,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle>; scale?: number }) {
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: 1 - (1 - scale) * pressed.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      style={[style, animated]}
      onPressIn={(event) => {
        pressed.value = withTiming(1, { duration: duration.press });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withSpring(0, spring.press);
        onPressOut?.(event);
      }}
      onPress={
        onPress &&
        ((event) => {
          haptic();
          onPress(event);
        })
      }
    />
  );
}
