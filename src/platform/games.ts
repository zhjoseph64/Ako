import type { Href } from "expo-router";

import type { GameArtKind } from "./GameArt";

export type Game = {
  key: string;
  title: string;
  art: GameArtKind;
  bg: string;
  isNew?: boolean;
  live?: "unpredictable" | "jailbreak";
  href?: Href;
  basePay: number;
  cadence: string;
};

export const GAMES: Game[] = [
  { key: "unpredictable", title: "Unpredictable", art: "gut", bg: "#1B1730", live: "unpredictable", href: "/unpredictable", basePay: 720, cadence: "Daily" },
  { key: "snap", title: "Snap the Rare", art: "snap", bg: "#1A1424", isNew: true, basePay: 900, cadence: "New" },
  { key: "fib", title: "Spot the Fib", art: "fib", bg: "#131B2B", basePay: 500, cadence: "Daily" },
  { key: "crowd", title: "Crowd Pleaser", art: "crowd", bg: "#1E1528", basePay: 300, cadence: "Daily" },
  { key: "ways", title: "Two Ways There", art: "ways", bg: "#10201F", isNew: true, basePay: 650, cadence: "New" },
  { key: "jailbreak", title: "Jailbreak Boss", art: "breach", bg: "#0E1322", live: "jailbreak", href: "/jailbreak", basePay: 300, cadence: "Live" },
];
