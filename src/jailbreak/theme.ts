export const PIXEL_FONT = "PressStart2P_400Regular";

export const colors = {
  ink: "#140c18",
  night: "#1d1222",
  stone: "#2c2133",
  stoneLight: "#4a3a52",
  stoneEdge: "#6b5874",
  parchment: "#f3e6c4",
  parchmentDark: "#d8c495",
  ember: "#ff8a1f",
  lava: "#e2421b",
  gold: "#f6c445",
  rune: "#56d4ff",
  held: "#ff5a4e",
  partial: "#f6c445",
  full: "#7dff8a",
  muted: "#b7a7bf",
};

export const outcomeColor = {
  held: colors.held,
  partial: colors.partial,
  full: colors.full,
} as const;

export const KNIGHT_SKINS = [
  require("../../assets/jailbreak/knight_red.png"),
  require("../../assets/jailbreak/knight_teal.png"),
  require("../../assets/jailbreak/knight_gold.png"),
  require("../../assets/jailbreak/knight_violet.png"),
  require("../../assets/jailbreak/knight_green.png"),
  require("../../assets/jailbreak/knight_orange.png"),
  require("../../assets/jailbreak/knight_pink.png"),
  require("../../assets/jailbreak/knight_white.png"),
];

export const KNIGHT_COLORS = ["#ff4d4d", "#2fe0d0", "#ffd23f", "#b77cff", "#5ee36a", "#ff9a2e", "#ff6fc0", "#f4f4ff"];

export const ARENA_IMAGE = require("../../assets/jailbreak/arena.png");
export const DRAGON_SHEET = require("../../assets/jailbreak/dragon_spritesheet.png");
export const FIREBALL = require("../../assets/jailbreak/fireball.png");
export const BOLT = require("../../assets/jailbreak/bolt.png");
