import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { colors } from "./theme";

export function Avatar({ color, size = 44 }: { color: string; size?: number }) {
  const id = `avatar-${color.replace("#", "")}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44">
      <Defs>
        <LinearGradient id={id} x1="0.3" y1="0" x2="0.7" y2="1">
          <Stop offset="0" stopColor={color} />
          <Stop offset="1" stopColor={colors.periwinkle} />
        </LinearGradient>
      </Defs>
      <Rect width="44" height="44" rx="22" fill={`url(#${id})`} />
      <Rect x="13" y="16.5" width="5.5" height="8.8" rx="2.75" fill="#141120" />
      <Rect x="27.3" y="16.5" width="5.5" height="8.8" rx="2.75" fill="#141120" />
      <Path d="M15.4 30.8 Q22 35.2 28.6 30.8" fill="none" stroke="#141120" strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}
