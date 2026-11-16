import { Easing } from "react-native-reanimated";

export const duration = { press: 90, fast: 160, base: 240, slow: 340, count: 750, stagger: 45 };

export const easing = {
  out: Easing.out(Easing.cubic),
  in: Easing.in(Easing.cubic),
  standard: Easing.bezier(0.2, 0.8, 0.2, 1),
};

export const spring = {
  press: { damping: 14, stiffness: 320, mass: 0.6 },
  pop: { damping: 10, stiffness: 260, mass: 0.7 },
  settle: { damping: 26, stiffness: 300, mass: 0.9 },
};
