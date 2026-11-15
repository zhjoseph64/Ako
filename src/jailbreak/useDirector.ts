import { useCallback, useEffect, useRef, useState } from "react";
import type { Doc } from "../../convex/_generated/dataModel";
import type { DragonAnim } from "./DragonSprite";

type Attack = Doc<"jbAttacks">;
type Room = Doc<"jbRooms">;

export type Launch = { id: string; playerId: string; text: string };
export type Fireball = { id: string; playerId: string };
export type ResultLabel = { key: number; text: string; outcome: "held" | "partial" | "full" | "error" };
export type BossBubble = { key: number; text: string; to: string };

const BUBBLE_MS = 1600;
const FLIGHT_MS = 650;
const MAX_QUEUED = 3;

export function useDirector(attacks: Attack[] | undefined, room: Room | undefined) {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [flights, setFlights] = useState<Launch[]>([]);
  const [fireball, setFireball] = useState<Fireball | null>(null);
  const [dragon, setDragon] = useState<{ anim: DragonAnim; key: number }>({ anim: "idle", key: 0 });
  const [label, setLabel] = useState<ResultLabel | null>(null);
  const [bubble, setBubble] = useState<BossBubble | null>(null);
  const [holds, setHolds] = useState<Record<string, number>>({});
  const [hitPlayer, setHitPlayer] = useState<{ playerId: string; key: number } | null>(null);
  const [version, setVersion] = useState(0);
  const [reactedIds, setReactedIds] = useState<ReadonlySet<string>>(new Set());
  const [landedIds, setLandedIds] = useState<ReadonlySet<string>>(new Set());

  const latest = useRef<Attack[]>([]);
  const initialized = useRef(false);
  const seen = useRef(new Set<string>());
  const landed = useRef(new Set<string>());
  const reacted = useRef(new Set<string>());
  const queue = useRef<Attack[]>([]);
  const busy = useRef(false);
  const counter = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const finish = useCallback((attack: Attack) => {
    reacted.current.add(attack._id);
    setReactedIds(new Set(reacted.current));
    setHolds((current) => {
      const next = { ...current };
      delete next[attack.playerId];
      return next;
    });
    busy.current = false;
    setVersion((v) => v + 1);
  }, []);

  const react = useCallback(
    (attack: Attack) => {
      busy.current = true;
      const key = counter.current++;
      const reply = attack.reply ?? "...";
      const name = attack.playerName.toUpperCase();
      if (attack.status === "error" || !attack.outcome) {
        setBubble({ key, text: reply, to: attack.playerName });
        setLabel({ key, text: "BOSS ERROR", outcome: "error" });
        later(1600, () => finish(attack));
        return;
      }
      setBubble({ key, text: reply, to: attack.playerName });
      if (attack.outcome === "held") {
        setDragon({ anim: "attack", key });
        later(450, () => setFireball({ id: attack._id, playerId: attack.playerId }));
        later(1050, () => {
          setFireball(null);
          setHitPlayer({ playerId: attack.playerId, key });
          setLabel({ key, text: `${attack.label ?? "RULE HELD"}: ${name} PUSHED BACK`, outcome: "held" });
          finish(attack);
        });
        return;
      }
      if (attack.outcome === "partial") {
        setDragon({ anim: "hurt", key });
        setLabel({ key, text: `${attack.label ?? "PARTIAL BREAK"}: ${name} ADVANCES`, outcome: "partial" });
        later(900, () => finish(attack));
        return;
      }
      setDragon({ anim: "defeat", key });
      setLabel({ key, text: `BOSS DEFEATED BY ${name}!`, outcome: "full" });
      later(3400, () => finish(attack));
    },
    [finish, later],
  );

  const pump = useCallback(() => {
    for (const attack of latest.current) {
      if (
        attack.status !== "pending" &&
        landed.current.has(attack._id) &&
        !reacted.current.has(attack._id) &&
        !queue.current.some((queued) => queued._id === attack._id)
      ) {
        queue.current.push({ ...attack });
      }
    }
    while (queue.current.length > MAX_QUEUED) {
      const skipped = queue.current.shift()!;
      reacted.current.add(skipped._id);
      setReactedIds(new Set(reacted.current));
    }
    if (busy.current) return;
    const next = queue.current.shift();
    if (next) react(next);
  }, [react]);

  useEffect(() => {
    if (!busy.current) pump();
  }, [version, pump]);

  useEffect(() => {
    if (!attacks) return;
    latest.current = attacks;
    if (!initialized.current) {
      initialized.current = true;
      for (const attack of attacks) {
        seen.current.add(attack._id);
        landed.current.add(attack._id);
        reacted.current.add(attack._id);
      }
      setReactedIds(new Set(reacted.current));
      setLandedIds(new Set(landed.current));
      setVersion((v) => v + 1);
      return;
    }
    for (const attack of attacks) {
      if (seen.current.has(attack._id)) continue;
      seen.current.add(attack._id);
      const launch = { id: attack._id, playerId: attack.playerId, text: attack.prompt };
      setHolds((current) => ({ ...current, [attack.playerId]: attack.ringBefore }));
      setLaunches((current) => [...current, launch]);
      later(BUBBLE_MS, () => {
        setLaunches((current) => current.filter((l) => l.id !== launch.id));
        setFlights((current) => [...current, launch]);
      });
      later(BUBBLE_MS + FLIGHT_MS, () => {
        setFlights((current) => current.filter((l) => l.id !== launch.id));
        landed.current.add(launch.id);
        setLandedIds(new Set(landed.current));
        pump();
      });
    }
    pump();
  }, [attacks, later, pump]);

  useEffect(() => {
    if (room?.status === "active") setDragon((d) => (d.anim === "defeated" || d.anim === "defeat" ? { anim: "idle", key: counter.current++ } : d));
  }, [room?.status, room?.round]);

  const winning = attacks?.find((a) => room && a.round === room.round && a.outcome === "full");
  const defeatShown =
    room?.status === "defeated" && (!winning || reactedIds.has(winning._id));
  const thinking = (attacks ?? []).some(
    (a) => a.status === "pending" && landedIds.has(a._id),
  );

  return {
    launches,
    flights,
    fireball,
    dragon: defeatShown && dragon.anim !== "defeat" ? { anim: "defeated" as const, key: dragon.key } : dragon,
    label,
    bubble,
    holds,
    hitPlayer,
    defeatShown,
    thinking,
    hasReacted: (id: string) => reactedIds.has(id),
    flightMs: FLIGHT_MS,
  };
}
