import { createContext, type ReactNode, useContext } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { GestureDetector, type PanGesture, usePanGesture } from "react-native-gesture-handler";
import Animated, { runOnJS, type SharedValue, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { haptic } from "./haptics";
import { spring } from "./tokens";

const SwipeContext = createContext<{ drag: SharedValue<number>; gesture: PanGesture } | null>(null);

export function TabSwipe({
  index,
  count,
  onChange,
  children,
}: {
  index: number;
  count: number;
  onChange: (index: number) => void;
  children: ReactNode;
}) {
  const drag = useSharedValue(0);
  const step = (direction: number) => {
    haptic("tick");
    onChange(index + direction);
  };
  const gesture = usePanGesture({
    enabled: index >= 0,
    activeOffsetX: [-22, 22],
    failOffsetY: [-14, 14],
    onUpdate: (event) => {
      "worklet";
      const edge = event.translationX > 0 ? index === 0 : index === count - 1;
      drag.set(event.translationX * (edge ? 0.1 : 0.35));
    },
    onDeactivate: (event) => {
      "worklet";
      const edge = event.translationX > 0 ? index === 0 : index === count - 1;
      const far = Math.abs(event.translationX) > 64 || Math.abs(event.velocityX) > 500;
      if (!event.canceled && !edge && far) runOnJS(step)(event.translationX < 0 ? 1 : -1);
      drag.set(withSpring(0, spring.settle));
    },
  });
  return (
    <SwipeContext.Provider value={{ drag, gesture }}>
      <GestureDetector gesture={gesture} touchAction="pan-y">
        <View style={{ flex: 1 }}>{children}</View>
      </GestureDetector>
    </SwipeContext.Provider>
  );
}

export function TabScene({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const swipe = useContext(SwipeContext);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: swipe ? swipe.drag.get() : 0 }] }));
  return <Animated.View style={[{ flex: 1 }, style, animated]}>{children}</Animated.View>;
}

export function SwipeBlock({ children }: { children: ReactNode }) {
  const hold = usePanGesture({ activeOffsetX: [-6, 6], cancelsJSResponder: false, cancelsTouchesInView: false });
  return (
    <GestureDetector gesture={hold} touchAction="pan-y">
      <View>{children}</View>
    </GestureDetector>
  );
}
