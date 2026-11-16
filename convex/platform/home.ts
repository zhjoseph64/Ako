import { v } from "convex/values";

import { query } from "../_generated/server";

const ARENA_CODE = "DRAGON";
const ACTIVE_MS = 5 * 60_000;

export const jailbreakArena = query({
  args: { now: v.number() },
  returns: v.object({
    code: v.string(),
    bossName: v.union(v.string(), v.null()),
    defeated: v.boolean(),
    round: v.number(),
    knights: v.number(),
  }),
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("jbRooms")
      .withIndex("by_code", (q) => q.eq("code", ARENA_CODE))
      .unique();
    if (!room) return { code: ARENA_CODE, bossName: null, defeated: false, round: 1, knights: 0 };
    const players = await ctx.db
      .query("jbPlayers")
      .withIndex("by_roomId", (q) => q.eq("roomId", room._id))
      .take(100);
    return {
      code: ARENA_CODE,
      bossName: room.bossName,
      defeated: room.status === "defeated",
      round: room.round,
      knights: players.filter((p) => p.lastSeen > args.now - ACTIVE_MS).length,
    };
  },
});
