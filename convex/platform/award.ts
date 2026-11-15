import { Infer, v } from "convex/values";

import { internalMutation, MutationCtx, QueryCtx } from "../_generated/server";
import { rankFor, START_RATING } from "./ranks";
import { platGame } from "./tables";

const DEFAULT_AVATAR = { color: "#B9A6FF", frame: "none", aura: "none" };
const DEFAULT_NAME = "Player";
const DAY_MS = 86_400_000;

export function dayKey(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

export async function profileByDevice(ctx: QueryCtx, deviceId: string) {
  return await ctx.db
    .query("platProfiles")
    .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
    .unique();
}

export async function ensureProfile(ctx: MutationCtx, deviceId: string, name?: string) {
  const trimmed = name?.trim().slice(0, 20);
  const existing = await profileByDevice(ctx, deviceId);
  if (existing) {
    if (trimmed && existing.name === DEFAULT_NAME) {
      await ctx.db.patch("platProfiles", existing._id, { name: trimmed });
      return { ...existing, name: trimmed };
    }
    return existing;
  }
  const id = await ctx.db.insert("platProfiles", {
    deviceId,
    name: trimmed || DEFAULT_NAME,
    avatar: DEFAULT_AVATAR,
    rating: START_RATING,
    points: 0,
    cashedOutCents: 0,
    streakDays: 0,
  });
  return (await ctx.db.get("platProfiles", id))!;
}

const awardArgs = v.object({
  deviceId: v.string(),
  name: v.optional(v.string()),
  game: platGame,
  basePoints: v.number(),
  ratingDelta: v.number(),
  note: v.string(),
});

export async function applyAward(ctx: MutationCtx, args: Infer<typeof awardArgs>) {
  const profile = await ensureProfile(ctx, args.deviceId, args.name);
  const now = Date.now();
  const today = dayKey(now);
  const multiplier = rankFor(profile.rating).multiplier;
  const points = Math.round(args.basePoints * multiplier);
  const rating = Math.max(0, profile.rating + args.ratingDelta);
  const streakDays =
    profile.lastPlayedDay === today
      ? profile.streakDays
      : profile.lastPlayedDay === dayKey(now - DAY_MS)
        ? profile.streakDays + 1
        : 1;
  await ctx.db.patch("platProfiles", profile._id, {
    rating,
    points: profile.points + points,
    streakDays,
    lastPlayedDay: today,
  });
  await ctx.db.insert("platLedger", {
    deviceId: args.deviceId,
    game: args.game,
    basePoints: args.basePoints,
    multiplier,
    points,
    ratingDelta: rating - profile.rating,
    ratingAfter: rating,
    pointsAfter: profile.points + points,
    note: args.note,
    createdAt: now,
  });
  return points;
}

export const award = internalMutation({
  args: awardArgs.fields,
  returns: v.number(),
  handler: applyAward,
});
