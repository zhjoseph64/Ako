import { defineTable } from "convex/server";
import { v } from "convex/values";

export const unpredictableTables = {
  unpPrompts: defineTable({
    set: v.number(),
    index: v.number(),
    text: v.string(),
    common: v.array(v.string()),
  }).index("by_set_and_index", ["set", "index"]),

  unpPlayers: defineTable({
    deviceId: v.string(),
    name: v.string(),
  }).index("by_deviceId", ["deviceId"]),

  unpSessions: defineTable({
    playerId: v.id("unpPlayers"),
    day: v.string(),
    set: v.number(),
    status: v.union(v.literal("preparing"), v.literal("ready")),
  }).index("by_playerId_and_day", ["playerId", "day"]),

  unpRounds: defineTable({
    sessionId: v.id("unpSessions"),
    playerId: v.id("unpPlayers"),
    promptId: v.id("unpPrompts"),
    index: v.number(),
    promptText: v.string(),
    guesses: v.array(v.string()),
    reason: v.string(),
    usedMemory: v.boolean(),
    status: v.union(
      v.literal("sealed"),
      v.literal("open"),
      v.literal("judging"),
      v.literal("done"),
    ),
    startedAt: v.optional(v.number()),
    answer: v.optional(v.string()),
    outcome: v.optional(
      v.union(v.literal("predicted"), v.literal("escaped"), v.literal("void")),
    ),
    judgeReason: v.optional(v.string()),
    matchedGuess: v.optional(v.number()),
    clusterId: v.optional(v.id("unpClusters")),
  }).index("by_sessionId_and_index", ["sessionId", "index"]),

  unpClusters: defineTable({
    promptId: v.id("unpPrompts"),
    key: v.string(),
    label: v.string(),
    humanCount: v.number(),
    aiCount: v.number(),
  }).index("by_promptId_and_key", ["promptId", "key"]),
};
