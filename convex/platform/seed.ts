import { v } from "convex/values";

import { internalMutation } from "../_generated/server";
import { applyAward } from "./award";
import { weekStart } from "./leaderboard";

const FAKE_PLAYERS: [string, number, string][] = [
  ["nova", 3620, "#F0A9DC"],
  ["kairo", 3240, "#8E9BF0"],
  ["mxl", 2910, "#79E2D6"],
  ["juniper", 2780, "#B9A6FF"],
  ["static.wav", 2540, "#FF9A85"],
  ["orbit", 2310, "#9FD9E6"],
  ["lumen", 2160, "#F0A9DC"],
  ["pixelmoth", 1990, "#B9A6FF"],
  ["hexa", 1840, "#8E9BF0"],
  ["quietfox", 1720, "#79E2D6"],
  ["byte_bard", 1600, "#FF9A85"],
  ["sable", 1480, "#9FD9E6"],
  ["tango", 1350, "#F0A9DC"],
  ["wren", 1210, "#B9A6FF"],
  ["delta9", 1090, "#8E9BF0"],
  ["mochi", 960, "#79E2D6"],
  ["ivo", 820, "#FF9A85"],
  ["paperplane", 640, "#9FD9E6"],
  ["glint", 480, "#F0A9DC"],
  ["sol", 300, "#B9A6FF"],
];

export const run = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const since = weekStart(Date.now());
    const alreadySeeded = await ctx.db
      .query("platLedger")
      .withIndex("by_deviceId_and_createdAt", (q) => q.eq("deviceId", "seed_00").gte("createdAt", since))
      .first();
    if (alreadySeeded) return "Already seeded this week";
    for (const [index, [name, rating, color]] of FAKE_PLAYERS.entries()) {
      const deviceId = `seed_${String(index).padStart(2, "0")}`;
      const existing = await ctx.db
        .query("platProfiles")
        .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
        .unique();
      if (existing) {
        await ctx.db.patch("platProfiles", existing._id, { rating });
      } else {
        await ctx.db.insert("platProfiles", {
          deviceId,
          name,
          avatar: { color, frame: "none", aura: "none" },
          rating,
          points: 0,
          cashedOutCents: 0,
          streakDays: 0,
        });
      }
      const rounds = 3 + ((FAKE_PLAYERS.length - index) % 7) + Math.floor((FAKE_PLAYERS.length - index) / 2);
      for (let round = 0; round < rounds; round++) {
        const jailbreak = round % 4 === 3;
        await applyAward(ctx, {
          deviceId,
          game: jailbreak ? "jailbreak" : "unpredictable",
          basePoints: jailbreak ? 300 : 120,
          ratingDelta: 0,
          note: "Seed",
        });
      }
    }
    return `Seeded ${FAKE_PLAYERS.length} players`;
  },
});
