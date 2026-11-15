import { defineTable } from "convex/server";
import { v } from "convex/values";

export const winCheckType = v.union(v.literal("word"), v.literal("exact"), v.literal("regex"));
export const attackOutcome = v.union(v.literal("held"), v.literal("partial"), v.literal("full"));

export const jailbreakTables = {
  jbRooms: defineTable({
    code: v.string(),
    hostId: v.string(),
    bossName: v.string(),
    instruction: v.string(),
    targetDescription: v.string(),
    allowedReply: v.string(),
    winCheckType,
    winCheck: v.string(),
    status: v.union(v.literal("active"), v.literal("defeated")),
    round: v.number(),
    winnerId: v.optional(v.string()),
    winnerName: v.optional(v.string()),
    winningAttackId: v.optional(v.id("jbAttacks")),
  }).index("by_code", ["code"]),

  jbPlayers: defineTable({
    roomId: v.id("jbRooms"),
    playerId: v.string(),
    secret: v.optional(v.string()),
    name: v.string(),
    ring: v.number(),
    slot: v.number(),
    chatEpoch: v.number(),
    lastSeen: v.number(),
    credits: v.optional(v.number()),
  })
    .index("by_roomId", ["roomId"])
    .index("by_roomId_and_playerId", ["roomId", "playerId"]),

  jbAttacks: defineTable({
    roomId: v.id("jbRooms"),
    playerId: v.string(),
    playerName: v.string(),
    clientAttackId: v.string(),
    prompt: v.string(),
    round: v.number(),
    chatEpoch: v.number(),
    status: v.union(v.literal("pending"), v.literal("resolved"), v.literal("error")),
    ringBefore: v.number(),
    ringAfter: v.optional(v.number()),
    reply: v.optional(v.string()),
    outcome: v.optional(attackOutcome),
    label: v.optional(v.string()),
    adapter: v.optional(v.string()),
  })
    .index("by_roomId", ["roomId"])
    .index("by_roomId_and_playerId", ["roomId", "playerId"])
    .index("by_roomId_and_playerId_and_round_and_chatEpoch", ["roomId", "playerId", "round", "chatEpoch"])
    .index("by_playerId_and_clientAttackId", ["playerId", "clientAttackId"]),
};
