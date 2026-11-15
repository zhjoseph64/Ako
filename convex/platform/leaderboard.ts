import { v } from "convex/values";

import { query } from "../_generated/server";
import { rankFor } from "./ranks";

const LIVE_MS = 5 * 60_000;

export function weekStart(time: number) {
  const date = new Date(time);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.getTime();
}

export const leaderboard = query({
  args: { deviceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("platLedger")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", weekStart(Date.now())))
      .take(5000);
    const totals = new Map<string, number>();
    for (const row of rows) {
      if (row.game === "cashout" || row.points <= 0) continue;
      totals.set(row.deviceId, (totals.get(row.deviceId) ?? 0) + row.points);
    }
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const myIndex = args.deviceId ? ranked.findIndex(([id]) => id === args.deviceId) : -1;
    const entries = [];
    for (const [index, [deviceId, points]] of ranked.slice(0, 50).entries()) {
      const profile = await ctx.db
        .query("platProfiles")
        .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
        .unique();
      if (!profile) continue;
      const rank = rankFor(profile.rating);
      entries.push({
        position: index + 1,
        name: profile.name,
        avatar: profile.avatar,
        tier: rank.tier,
        division: rank.division,
        points,
        isMe: deviceId === args.deviceId,
      });
    }
    return {
      entries,
      me: myIndex === -1 ? null : { position: myIndex + 1, points: ranked[myIndex][1] },
    };
  },
});

export const liveCounts = query({
  args: {},
  returns: v.object({ unpredictable: v.number(), jailbreak: v.number() }),
  handler: async (ctx) => {
    const cutoff = Date.now() - LIVE_MS;
    const knights = await ctx.db.query("jbPlayers").take(2000);
    const jailbreak = new Set(knights.filter((k) => k.lastSeen > cutoff).map((k) => k.playerId));
    const rounds = await ctx.db.query("unpRounds").order("desc").take(500);
    const unpredictable = new Set(
      rounds.filter((r) => (r.startedAt ?? 0) > cutoff).map((r) => r.playerId),
    );
    return { unpredictable: unpredictable.size, jailbreak: jailbreak.size };
  },
});
