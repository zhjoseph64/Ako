import { v } from "convex/values";

import { Doc } from "../_generated/dataModel";
import { mutation, query, QueryCtx } from "../_generated/server";
import { DAY_MS, dayKey, ensureProfile, profileByDevice, requireOwnProfile } from "./award";
import { rankFor, START_RATING } from "./ranks";
import { platAvatar } from "./tables";

const RANGE_MS = { "1D": DAY_MS, "1W": 7 * DAY_MS, "1M": 30 * DAY_MS, "3M": 90 * DAY_MS, ALL: null };
const credentials = { deviceId: v.string(), secret: v.string() };
const MATCH_GAP_MS = 20 * 60_000;

async function firstActivity(ctx: QueryCtx, profile: Doc<"platProfiles">) {
  const first = await ctx.db
    .query("platLedger")
    .withIndex("by_deviceId_and_createdAt", (q) => q.eq("deviceId", profile.deviceId))
    .first();
  return Math.min(profile._creationTime, first?.createdAt ?? Infinity);
}

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
      joinedAt: await firstActivity(ctx, profile),
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
    const started = await firstActivity(ctx, profile);
    const since = span === null ? started : Math.max(started, args.now - span);
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

export const stats = query({
  args: { deviceId: v.string() },
  returns: v.object({ aiFooledPercent: v.union(v.number(), v.null()), labelsVerified: v.number() }),
  handler: async (ctx, args) => {
    let fooled = 0;
    let verified = 0;
    const player = await ctx.db
      .query("unpPlayers")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
      .unique();
    if (player) {
      const sessions = await ctx.db
        .query("unpSessions")
        .withIndex("by_playerId_and_day", (q) => q.eq("playerId", player._id))
        .order("desc")
        .take(60);
      for (const session of sessions) {
        const rounds = await ctx.db
          .query("unpRounds")
          .withIndex("by_sessionId_and_index", (q) => q.eq("sessionId", session._id))
          .take(20);
        for (const round of rounds) {
          if (round.outcome !== "escaped" && round.outcome !== "predicted") continue;
          verified++;
          if (round.outcome === "escaped") fooled++;
        }
      }
    }
    const attacks = await ctx.db
      .query("jbAttacks")
      .withIndex("by_playerId_and_clientAttackId", (q) => q.eq("playerId", args.deviceId))
      .take(1000);
    for (const attack of attacks) {
      if (attack.status !== "resolved" || !attack.outcome) continue;
      verified++;
      if (attack.outcome !== "held") fooled++;
    }
    return {
      aiFooledPercent: verified === 0 ? null : Math.round((fooled / verified) * 100),
      labelsVerified: verified,
    };
  },
});

export const activity = query({
  args: { deviceId: v.string(), dayStart: v.number(), monthStart: v.number() },
  handler: async (ctx, args) => {
    const month = await ctx.db
      .query("platLedger")
      .withIndex("by_deviceId_and_createdAt", (q) => q.eq("deviceId", args.deviceId).gte("createdAt", args.monthStart))
      .order("desc")
      .take(2000);
    month.reverse();
    let monthPoints = 0;
    let dayPoints = 0;
    const monthSeries = [0];
    for (const row of month) {
      if (row.points <= 0 || row.game === "cashout" || row.game === "purchase") continue;
      monthPoints += row.points;
      if (row.createdAt >= args.dayStart) dayPoints += row.points;
      monthSeries.push(monthPoints);
    }
    const step = Math.max(1, Math.ceil(monthSeries.length / 24));
    const spark = monthSeries.filter((_, index) => index % step === 0 || index === monthSeries.length - 1);

    const recent = await ctx.db
      .query("platLedger")
      .withIndex("by_deviceId_and_createdAt", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .take(200);
    const entries: {
      game: string;
      at: number;
      startedAt: number;
      rounds: number;
      wins: number;
      points: number;
      ratingDelta: number;
      multiplier: number;
      note: string;
    }[] = [];
    for (const row of recent) {
      const last = entries.at(-1);
      const isGame = row.game === "unpredictable" || row.game === "jailbreak";
      if (isGame && last && last.game === row.game && last.startedAt - row.createdAt <= MATCH_GAP_MS) {
        last.startedAt = row.createdAt;
        last.rounds++;
        last.wins += row.points > 0 ? 1 : 0;
        last.points += row.points;
        last.ratingDelta += row.ratingDelta;
        continue;
      }
      if (entries.length === 12) break;
      entries.push({
        game: row.game,
        at: row.createdAt,
        startedAt: row.createdAt,
        rounds: 1,
        wins: row.points > 0 ? 1 : 0,
        points: row.points,
        ratingDelta: row.ratingDelta,
        multiplier: row.multiplier,
        note: row.note,
      });
    }
    return { monthPoints, dayPoints, spark, entries };
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
