import { useEffect, useState } from "react";
import { Animated, Easing, Image, View } from "react-native";
import { DRAGON_SHEET } from "./theme";

export type DragonAnim = "idle" | "attack" | "hurt" | "defeat" | "defeated";

const FRAME_W = 80;
const FRAME_H = 96;
const SHEET_W = 1040;
const SHEET_H = 288;
export const DRAGON_ANCHOR_PX = { x: 40, y: 62 };

const IDLE = { row: 0, durations: [120, 120, 120, 120, 120, 120, 120, 120] };
const ATTACK = { row: 1, durations: [110, 110, 150, 60, 60, 70, 80, 80, 80, 90, 100, 110, 120] };
const HURT = { row: 2, durations: [70, 70, 80, 80, 100, 120] };

export function DragonSprite({ anim, animKey, scale }: { anim: DragonAnim; animKey: number; scale: number }) {
  const [frame, setFrame] = useState({ row: 0, col: 0 });
  const [tilt] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const steps: { row: number; col: number; ms: number }[] = [];
    const push = (clip: typeof IDLE, times = 1) => {
      for (let t = 0; t < times; t++) clip.durations.forEach((ms, col) => steps.push({ row: clip.row, col, ms }));
    };
    if (anim === "attack") push(ATTACK);
    if (anim === "hurt") push(HURT, 2);
    if (anim === "defeat") push(HURT, 4);
    const loopIdle = anim === "idle" || anim === "attack" || anim === "hurt";
    let index = 0;
    const tick = () => {
      if (cancelled) return;
      if (index < steps.length) {
        const step = steps[index++];
        setFrame({ row: step.row, col: step.col });
        timer = setTimeout(tick, step.ms);
        return;
      }
      if (!loopIdle) {
        setFrame({ row: 0, col: 0 });
        return;
      }
      const col = (index - steps.length) % IDLE.durations.length;
      index++;
      setFrame({ row: IDLE.row, col });
      timer = setTimeout(tick, IDLE.durations[col]);
    };
    tick();
    Animated.timing(tilt, {
      toValue: anim === "defeat" || anim === "defeated" ? 1 : 0,
      duration: anim === "defeat" ? 2200 : 0,
      delay: anim === "defeat" ? 1100 : 0,
      easing: Easing.bounce,
      useNativeDriver: false,
    }).start();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [anim, animKey, tilt]);

  const w = FRAME_W * scale;
  const h = FRAME_H * scale;
  return (
    <Animated.View
      style={{
        width: w,
        height: h,
        opacity: tilt.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }),
        transform: [
          { translateY: tilt.interpolate({ inputRange: [0, 1], outputRange: [0, 18 * scale] }) },
          { rotate: tilt.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-14deg"] }) },
        ],
      }}
    >
      <View style={{ width: w, height: h, overflow: "hidden" }}>
        <Image
          source={DRAGON_SHEET}
          style={{
            position: "absolute",
            width: SHEET_W * scale,
            height: SHEET_H * scale,
            left: -frame.col * w,
            top: -frame.row * h,
          }}
        />
      </View>
    </Animated.View>
  );
}
