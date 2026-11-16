import { useEffect } from "react";
import { Platform, type ViewProps } from "react-native";
import Animated, { FadeIn, FadeInRight, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { duration, easing } from "./tokens";

export function Enter({ index = 0, style, ...rest }: ViewProps & { index?: number }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(withDelay(Math.min(index, 12) * duration.stagger, withTiming(1, { duration: duration.slow, easing: easing.out })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const animated = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateY: 14 * (1 - shown.get()) }] }));
  return <Animated.View {...rest} style={[style, animated]} />;
}

export const fadeIn = FadeIn.duration(duration.base).easing(easing.out);

export const webScreenIn =
  Platform.OS === "web"
    ? FadeInRight.duration(duration.base)
        .easing(easing.out)
        .withInitialValues({ transform: [{ translateX: 24 }] })
    : undefined;
