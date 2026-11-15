import { v } from "convex/values";

import { mutation, query } from "../_generated/server";
import { dayKey, ensureProfile, profileByDevice } from "./award";
import { rankFor, START_RATING } from "./ranks";
import { platAvatar } from "./tables";

const DAY_MS = 86_400_000;
const RANGE_MS = { "1D": DAY_MS, "1W": 7 * DAY_MS, "1M": 30 * DAY_MS, "3M": 90 * DAY_MS, ALL: null };

export const ensure = mutation({
  args: { deviceId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.deviceId.length < 8) throw new Error("Invalid device");
    const player = await ctx.db
      .query("unpPlayers")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
      .unique();
    await ensureProfile(ctx, args.deviceId, player?.name);
    return null;
  },
});

export const me = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const profile = await profileByDevice(ctx, args.deviceId);
    if (!profile) return null;
    const today = dayKey(Date.now());
    const yesterday = dayKey(Date.now() - DAY_MS);
    const streakAlive = profile.lastPlayedDay === today || profile.lastPlayedDay === yesterday;
    return {
      name: profile.name,
      avatar: profile.avatar,
      rating: profile.rating,
      points: profile.points,
      balanceCents: profile.points,
      cashedOutCents: profile.cashedOutCents,
      streakDays: streakAlive ? profile.streakDays : 0,
      ...rankFor(profile.rating),
    };
  },
});

export const history = query({
  args: {
    deviceId: v.string(),
    range: v.union(v.literal("1D"), v.literal("1W"), v.literal("1M"), v.literal("3M"), v.literal("ALL")),
  },
  handler: async (ctx, args) => {
    const profile = await profileByDevice(ctx, args.deviceId);
    if (!profile) return [];
    const span = RANGE_MS[args.range];
    const since = span === null ? profile._creationTime : Math.max(profile._creationTime, Date.now() - span);
    const before = await ctx.db
      .query("platLedger")
      .withIndex("by_deviceId_and_createdAt", (q) => q.eq("deviceId", args.deviceId).lt("createdAt", since))
      .order("desc")
      .first();
    const rows = await ctx.db
      .query("platLedger")
      .withIndex("by_deviceId_and_createdAt", (q) => q.eq("deviceId", args.deviceId).gte("createdAt", since))
      .take(1000);
    return [
      { t: since, rating: before?.ratingAfter ?? START_RATING, points: before?.pointsAfter ?? 0 },
      ...rows.map((row) => ({ t: row.createdAt, rating: row.ratingAfter, points: row.pointsAfter })),
    ];
  },
});

export const updateAvatar = mutation({
  args: { deviceId: v.string(), avatar: platAvatar },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await ensureProfile(ctx, args.deviceId);
    await ctx.db.patch("platProfiles", profile._id, { avatar: args.avatar });
    return null;
  },
});

export const cashOut = mutation({
  args: { deviceId: v.string(), points: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await profileByDevice(ctx, args.deviceId);
    const points = Math.floor(args.points);
    if (!profile) throw new Error("Play a game first");
    if (points < 100) throw new Error("Cash out at least $1.00");
    if (points > profile.points) throw new Error("Not enough points");
    await ctx.db.patch("platProfiles", profile._id, {
      points: profile.points - points,
      cashedOutCents: profile.cashedOutCents + points,
    });
    await ctx.db.insert("platLedger", {
      deviceId: args.deviceId,
      game: "cashout",
      basePoints: -points,
      multiplier: 1,
      points: -points,
      ratingDelta: 0,
      ratingAfter: profile.rating,
      pointsAfter: profile.points - points,
      note: "Demo cash-out",
      createdAt: Date.now(),
    });
    return null;
  },
});
