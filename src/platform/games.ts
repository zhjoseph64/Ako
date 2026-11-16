import type { Href } from "expo-router";
import type { ImageSourcePropType } from "react-native";

export type Game = {
  key: string;
  title: string;
  image: ImageSourcePropType;
  live?: "unpredictable" | "jailbreak";
  href?: Href;
  isNew?: boolean;
};

export const FEATURED_IMAGE: ImageSourcePropType = require("@/assets/games/jailbreak-featured.jpg");

export const GAMES: Game[] = [
  { key: "jailbreak", title: "Jailbreak Boss", image: require("@/assets/games/jailbreak.jpg"), live: "jailbreak", href: "/jailbreak" },
  { key: "unpredictable", title: "Unpredictable", image: require("@/assets/games/unpredictable.jpg"), live: "unpredictable", href: "/unpredictable" },
  { key: "snap", title: "Snap the Rare", image: require("@/assets/games/snap.jpg"), isNew: true },
  { key: "fib", title: "Spot the Fib", image: require("@/assets/games/fib.jpg") },
  { key: "crowd", title: "Crowd Pleaser", image: require("@/assets/games/crowd.jpg") },
  { key: "ways", title: "Two Ways There", image: require("@/assets/games/ways.jpg"), isNew: true },
  { key: "vibe", title: "Vibe Check", image: require("@/assets/games/vibe.jpg") },
  { key: "odd", title: "Odd One Out", image: require("@/assets/games/odd.jpg") },
  { key: "echo", title: "Echo Chamber", image: require("@/assets/games/echo.jpg"), isNew: true },
  { key: "hot", title: "Hot Take", image: require("@/assets/games/hot.jpg") },
];
