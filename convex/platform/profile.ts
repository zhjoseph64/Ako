import { v } from "convex/values";

import { mutation, query } from "../_generated/server";
import { DAY_MS, dayKey, ensureProfile, profileByDevice, requireOwnProfile } from "./award";
import { rankFor, START_RATING } from "./ranks";
import { platAvatar } from "./tables";

const RANGE_MS = { "1D": DAY_MS, "1W": 7 * DAY_MS, "1M": 30 * DAY_MS, "3M": 90 * DAY_MS, ALL: null };
const credentials = { deviceId: v.string(), secret: v.string() };

export const ensure = mutation({
  args: credentials,
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.deviceId.length < 8 || args.secret.length < 16) throw new Error("Invalid device");
    const player = await ctx.db
      .query("unpPlayers")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
      .unique();
    const profile = await ensureProfile(ctx, args.deviceId, player?.name);
    if (profile.secret === undefined) {
      await ctx.db.patch("platProfiles", profile._id, { secret: args.secret });
    } else if (profile.secret !== args.secret) {
      throw new Error("This profile belongs to another device");
    }
    return null;
  },
});

export const me = query({
  args: { deviceId: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const profile = await profileByDevice(ctx, args.deviceId);
    if (!profile) return null;
    const streakAlive =
      profile.lastPlayedDay === dayKey(args.now) || profile.lastPlayedDay === dayKey(args.now - DAY_MS);
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
    now: v.number(),
    range: v.union(v.literal("1D"), v.literal("1W"), v.literal("1M"), v.literal("3M"), v.literal("ALL")),
  },
  handler: async (ctx, args) => {
    const profile = await profileByDevice(ctx, args.deviceId);
    if (!profile) return [];
    const span = RANGE_MS[args.range];
    const since = span === null ? profile._creationTime : Math.max(profile._creationTime, args.now - span);
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
  args: { ...credentials, avatar: platAvatar },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireOwnProfile(ctx, args.deviceId, args.secret);
    await ctx.db.patch("platProfiles", profile._id, { avatar: args.avatar });
    return null;
  },
});

export const cashOut = mutation({
  args: { ...credentials, points: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireOwnProfile(ctx, args.deviceId, args.secret);
    if (!Number.isFinite(args.points)) throw new Error("Invalid amount");
    const points = Math.floor(args.points);
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
