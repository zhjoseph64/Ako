import { useEffect, useState } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, View } from "react-native";
import type { Doc } from "../../convex/_generated/dataModel";
import { DRAGON_ANCHOR_PX, DragonSprite } from "./DragonSprite";
import { DRAGON_ANCHOR, ringPosition, STAGE_HEIGHT, STAGE_WIDTH } from "./geometry";
import { ARENA_IMAGE, BOLT, colors, FIREBALL, KNIGHT_COLORS, KNIGHT_SKINS, outcomeColor } from "./theme";
import { PixelText, SpeechBubble } from "./ui";
import type { useDirector } from "./useDirector";

type Player = Doc<"jbPlayers">;
type Director = ReturnType<typeof useDirector>;

const KNIGHT_W = 16;
const KNIGHT_H = 20;
const KNIGHT_PX = 3.2;
const DRAGON_PX = 2.7;
const CROP = { x: 60, y: 140, w: 904, h: 590 };

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function Knight({
  player,
  ring,
  scale,
  pixel,
  isMe,
  hitKey,
  onPress,
}: {
  player: Player;
  ring: number;
  scale: number;
  pixel: number;
  isMe: boolean;
  hitKey: number | undefined;
  onPress: () => void;
}) {
  const target = ringPosition(ring, player.slot);
  const [pos] = useState(() => new Animated.ValueXY(target));
  const [shake] = useState(() => new Animated.Value(0));
  const [bob] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(pos, {
      toValue: target,
      duration: 750,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [pos, target.x, target.y]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hitKey === undefined) return;
    shake.setValue(0);
    Animated.timing(shake, { toValue: 1, duration: 500, useNativeDriver: false }).start();
  }, [hitKey, shake]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 420 + player.slot * 37, useNativeDriver: false }),
        Animated.timing(bob, { toValue: 0, duration: 420 + player.slot * 37, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, player.slot]);

  const w = KNIGHT_W * pixel;
  const h = KNIGHT_H * pixel;
  const tagSize = Math.max(7, Math.round(8 * scale + 1));
  const color = KNIGHT_COLORS[player.slot % KNIGHT_COLORS.length];
  const auraW = w * 1.5;
  const auraH = w * 0.55;
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: Animated.subtract(Animated.multiply(pos.x, scale), w / 2),
        top: Animated.subtract(Animated.multiply(pos.y, scale), h),
        alignItems: "center",
        width: w,
        transform: [
          {
            translateX: shake.interpolate({
              inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
              outputRange: [0, -6, 6, -4, 3, 0],
            }),
          },
        ],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${player.name}'s strategy ledger`}
        testID={`knight-${player.name}`}
        onPress={onPress}
        hitSlop={14}
        style={{ alignItems: "center" }}
      >
        {isMe && <View style={[styles.meMarker, { borderTopWidth: 9 }]} />}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: (w - auraW) / 2,
            top: (isMe ? 11 : 0) + h - auraH * 0.6,
            width: auraW,
            height: auraH,
            borderRadius: auraH,
            backgroundColor: color,
            borderWidth: 2,
            borderColor: isMe ? colors.gold : "#fff6d0",
            opacity: isMe ? bob.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0.45] }) : 0.55,
          }}
        />
        <Animated.Image
          source={KNIGHT_SKINS[player.slot % KNIGHT_SKINS.length]}
          style={{
            width: w,
            height: h,
            transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -2 * scale] }) }],
            opacity: shake.interpolate({ inputRange: [0, 0.1, 0.3, 0.5, 1], outputRange: [1, 0.3, 1, 0.3, 1] }),
          }}
        />
        <View style={[styles.nameTag, { backgroundColor: color, borderColor: isMe ? colors.gold : colors.ink }]}>
          <PixelText size={tagSize} color={colors.ink} numberOfLines={1}>
            {player.name}
          </PixelText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Projectile({
  from,
  to,
  scale,
  durationMs,
  kind,
  text,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  scale: number;
  durationMs: number;
  kind: "bolt" | "fire";
  text?: string;
}) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: durationMs, easing: Easing.in(Easing.quad), useNativeDriver: false }).start();
  }, [t, durationMs]);
  const size = (kind === "fire" ? 12 * 3.4 : 10 * 3) * scale;
  const arc = -60 * scale;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        alignItems: "center",
        left: t.interpolate({ inputRange: [0, 1], outputRange: [from.x * scale - size / 2, to.x * scale - size / 2] }),
        top: t.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [from.y * scale - size / 2, ((from.y + to.y) / 2) * scale + arc - size / 2, to.y * scale - size / 2],
        }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, kind === "bolt" ? 0.7 : 1.3] }) }],
      }}
    >
      <Image source={kind === "fire" ? FIREBALL : BOLT} style={{ width: size, height: size }} />
      {text ? (
        <View style={styles.boltText}>
          <PixelText size={Math.max(6, Math.round(7 * scale + 1))} color={colors.rune} numberOfLines={1}>
            {truncate(text, 18)}
          </PixelText>
        </View>
      ) : null}
    </Animated.View>
  );
}

function ResultBanner({ text, color, scale, labelKey }: { text: string; color: string; scale: number; labelKey: number }) {
  const [pop] = useState(() => new Animated.Value(0));
  useEffect(() => {
    pop.setValue(0);
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, useNativeDriver: false, friction: 5 }),
      Animated.delay(1900),
      Animated.timing(pop, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start();
  }, [labelKey, pop]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.banner,
        { top: 8, opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
      ]}
    >
      <View style={[styles.bannerBox, { borderColor: color }]}>
        <PixelText size={Math.max(10, Math.round(14 * scale + 2))} color={color} style={{ textAlign: "center" }}>
          {text}
        </PixelText>
      </View>
    </Animated.View>
  );
}

export function Arena({
  players,
  myId,
  width,
  height,
  director,
  winnerName,
  onSelectPlayer,
}: {
  players: Player[];
  myId: string;
  width: number;
  height: number;
  director: Director;
  winnerName?: string;
  onSelectPlayer: (player: Player) => void;
}) {
  const scale = Math.min(width / CROP.w, height / CROP.h);
  const stageW = STAGE_WIDTH * scale;
  const stageH = STAGE_HEIGHT * scale;
  const boost = Math.min(2.2, Math.max(1.2, 0.95 / scale));
  const knightPixel = KNIGHT_PX * scale * boost;
  const visibleLeft = CROP.x * scale;
  const visibleRight = (CROP.x + CROP.w) * scale;
  const [expiredBubble, setExpiredBubble] = useState<number | null>(null);
  const bubbleKey = director.bubble?.key ?? null;
  const bubbleVisible = bubbleKey !== null && bubbleKey !== expiredBubble;

  useEffect(() => {
    if (bubbleKey === null) return;
    const timer = setTimeout(() => setExpiredBubble(bubbleKey), 7000);
    return () => clearTimeout(timer);
  }, [bubbleKey]);

  const ringOf = (player: Player) => director.holds[player.playerId] ?? player.ring;
  const byId = new Map(players.map((p) => [p.playerId, p]));
  const posOf = (playerId: string) => {
    const player = byId.get(playerId);
    return player ? ringPosition(ringOf(player), player.slot) : { x: 512, y: 700 };
  };
  const dragonTarget = { x: DRAGON_ANCHOR.x, y: DRAGON_ANCHOR.y - 70 };
  const dScale = DRAGON_PX * scale * Math.min(1.4, boost);
  const dragonTop = DRAGON_ANCHOR.y * scale - DRAGON_ANCHOR_PX.y * dScale;
  const bubbleFont = Math.max(8, Math.round(10 * scale + 1));
  const knightH = KNIGHT_H * knightPixel;

  const drawables = [
    ...players.map((p) => ({ kind: "player" as const, y: ringPosition(ringOf(p), p.slot).y, player: p })),
    { kind: "dragon" as const, y: DRAGON_ANCHOR.y },
  ].sort((a, b) => a.y - b.y);

  const bossText = director.thinking && !bubbleVisible ? "..." : bubbleVisible && director.bubble ? director.bubble.text : null;

  return (
    <View style={{ width: CROP.w * scale, height: CROP.h * scale, overflow: "hidden" }}>
      <View style={{ position: "absolute", left: -visibleLeft, top: -CROP.y * scale, width: stageW, height: stageH }}>
      <Image source={ARENA_IMAGE} style={{ position: "absolute", width: stageW, height: stageH }} />
      {drawables.map((d) =>
        d.kind === "dragon" ? (
          <View
            key="dragon"
            pointerEvents="none"
            style={{ position: "absolute", left: DRAGON_ANCHOR.x * scale - DRAGON_ANCHOR_PX.x * dScale, top: dragonTop }}
          >
            <DragonSprite anim={director.dragon.anim} animKey={director.dragon.key} scale={dScale} />
          </View>
        ) : (
          <Knight
            key={d.player._id}
            player={d.player}
            ring={ringOf(d.player)}
            scale={scale}
            pixel={knightPixel}
            isMe={d.player.playerId === myId}
            hitKey={director.hitPlayer?.playerId === d.player.playerId ? director.hitPlayer.key : undefined}
            onPress={() => onSelectPlayer(d.player)}
          />
        ),
      )}

      {director.flights.map((flight) => (
        <Projectile
          key={`flight-${flight.id}`}
          from={{ x: posOf(flight.playerId).x, y: posOf(flight.playerId).y - 30 }}
          to={dragonTarget}
          scale={scale}
          durationMs={director.flightMs}
          kind="bolt"
          text={flight.text}
        />
      ))}
      {director.fireball && (
        <Projectile
          key={`fire-${director.fireball.id}`}
          from={{ x: DRAGON_ANCHOR.x, y: DRAGON_ANCHOR.y - 20 }}
          to={{ x: posOf(director.fireball.playerId).x, y: posOf(director.fireball.playerId).y - 25 }}
          scale={scale}
          durationMs={550}
          kind="fire"
        />
      )}

      {director.launches.map((launch) => {
        const pos = posOf(launch.playerId);
        const maxWidth = Math.max(150, 300 * scale);
        return (
          <View
            key={`launch-${launch.id}`}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: Math.min(Math.max(visibleLeft, pos.x * scale - maxWidth / 2), visibleRight - maxWidth),
              bottom: stageH - (pos.y * scale - knightH - 6),
              width: maxWidth,
              alignItems: "center",
            }}
          >
            <SpeechBubble text={truncate(launch.text, 110)} maxWidth={maxWidth} size={bubbleFont} tone="rune" numberOfLines={3} />
          </View>
        );
      })}

      {bossText && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: stageW / 2 - Math.max(160, 380 * scale) / 2,
            width: Math.max(160, 380 * scale),
            bottom: stageH - dragonTop - 18 * scale,
            alignItems: "center",
          }}
        >
          <SpeechBubble
            text={bossText === "..." ? "..." : truncate(bossText, 160)}
            maxWidth={Math.max(160, 380 * scale)}
            size={bubbleFont}
            tone="ember"
            numberOfLines={4}
          />
        </View>
      )}

      </View>

      {director.label && (
        <ResultBanner
          labelKey={director.label.key}
          text={director.label.text}
          scale={scale}
          color={director.label.outcome === "error" ? colors.muted : outcomeColor[director.label.outcome]}
        />
      )}

      {director.defeatShown && winnerName && (
        <View pointerEvents="none" style={[styles.victory, { bottom: 8 }]}>
          <View style={styles.bannerBox}>
            <PixelText size={Math.max(8, Math.round(12 * scale + 2))} color={colors.full} style={{ textAlign: "center" }}>
              {`${winnerName.toUpperCase()} BROKE THE BOSS`}
            </PixelText>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  nameTag: {
    marginTop: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: "rgba(20,12,24,0.85)",
    borderWidth: 2,
    borderColor: colors.ink,
    maxWidth: 140,
  },
  meMarker: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.gold,
    marginBottom: 2,
  },
  boltText: {
    backgroundColor: "rgba(20,12,24,0.8)",
    paddingHorizontal: 3,
    marginTop: 2,
  },
  banner: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  bannerBox: {
    backgroundColor: "rgba(20,12,24,0.92)",
    borderWidth: 3,
    borderColor: colors.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: "90%",
  },
  victory: { position: "absolute", left: 0, right: 0, alignItems: "center" },
});
