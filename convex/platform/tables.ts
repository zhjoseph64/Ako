import { defineTable } from "convex/server";
import { v } from "convex/values";

export const platGame = v.union(
  v.literal("unpredictable"),
  v.literal("jailbreak"),
  v.literal("leaderboard"),
  v.literal("cashout"),
);

export const platAvatar = v.object({ color: v.string(), frame: v.string(), aura: v.string() });

export const platformTables = {
  platProfiles: defineTable({
    deviceId: v.string(),
    secret: v.optional(v.string()),
    name: v.string(),
    avatar: platAvatar,
    rating: v.number(),
    points: v.number(),
    cashedOutCents: v.number(),
    streakDays: v.number(),
    lastPlayedDay: v.optional(v.string()),
  })
    .index("by_deviceId", ["deviceId"]),

  platLedger: defineTable({
    deviceId: v.string(),
    game: platGame,
    basePoints: v.number(),
    multiplier: v.number(),
    points: v.number(),
    ratingDelta: v.number(),
    ratingAfter: v.number(),
    pointsAfter: v.number(),
    note: v.string(),
    createdAt: v.number(),
  })
    .index("by_deviceId_and_createdAt", ["deviceId", "createdAt"]),

  platWeekly: defineTable({
    week: v.number(),
    deviceId: v.string(),
    points: v.number(),
  })
    .index("by_week_and_points", ["week", "points"])
    .index("by_deviceId_and_week", ["deviceId", "week"]),
};
