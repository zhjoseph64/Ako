import { v } from "convex/values";

import { query } from "../_generated/server";
import { profileByDevice, weekStart } from "./award";
import { rankFor } from "./ranks";

const LIVE_MS = 5 * 60_000;
const TOP = 50;

export const leaderboard = query({
  args: { deviceId: v.optional(v.string()), now: v.number() },
  handler: async (ctx, args) => {
    const week = weekStart(args.now);
    const top = await ctx.db
      .query("platWeekly")
      .withIndex("by_week_and_points", (q) => q.eq("week", week))
      .order("desc")
      .take(TOP);
    const entries = [];
    for (const [index, row] of top.entries()) {
      const profile = await profileByDevice(ctx, row.deviceId);
      if (!profile) continue;
      const rank = rankFor(profile.rating);
      entries.push({
        position: index + 1,
        name: profile.name,
        avatar: profile.avatar,
        tier: rank.tier,
        division: rank.division,
        points: row.points,
        isMe: row.deviceId === args.deviceId,
      });
    }
    const mine = args.deviceId
      ? await ctx.db
          .query("platWeekly")
          .withIndex("by_deviceId_and_week", (q) => q.eq("deviceId", args.deviceId!).eq("week", week))
          .unique()
      : null;
    let me = null;
    if (mine) {
      const ahead = await ctx.db
        .query("platWeekly")
        .withIndex("by_week_and_points", (q) => q.eq("week", week).gt("points", mine.points))
        .take(1000);
      me = { position: ahead.length + 1, points: mine.points };
    }
    return { entries, me };
  },
});

export const liveCounts = query({
  args: { now: v.number() },
  returns: v.object({ unpredictable: v.number(), jailbreak: v.number() }),
  handler: async (ctx, args) => {
    const cutoff = args.now - LIVE_MS;
    const knights = await ctx.db.query("jbPlayers").take(2000);
    const jailbreak = new Set(knights.filter((k) => k.lastSeen > cutoff).map((k) => k.playerId));
    const rounds = await ctx.db.query("unpRounds").order("desc").take(500);
    const unpredictable = new Set(
      rounds.filter((r) => (r.startedAt ?? 0) > cutoff).map((r) => r.playerId),
    );
    return { unpredictable: unpredictable.size, jailbreak: jailbreak.size };
  },
});
