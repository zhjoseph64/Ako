import { v } from "convex/values";

import { internalMutation, internalQuery, query } from "../_generated/server";
import { profileByDevice } from "../platform/award";
import { TOKEN_PACK } from "./pack";

export const ownsProfile = internalQuery({
  args: { deviceId: v.string(), secret: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const profile = await profileByDevice(ctx, args.deviceId);
    return profile !== null && profile.secret === args.secret;
  },
});

export const creditPayment = internalMutation({
  args: { paymentId: v.string(), deviceId: v.string(), pack: v.string() },
  returns: v.union(v.literal("credited"), v.literal("duplicate"), v.literal("unknown_player"), v.literal("unknown_pack")),
  handler: async (ctx, args) => {
    const seen = await ctx.db
      .query("whopPayments")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", args.paymentId))
      .unique();
    if (seen) return "duplicate";
    if (args.pack !== TOKEN_PACK.id) return "unknown_pack";
    const profile = await profileByDevice(ctx, args.deviceId);
    if (!profile) return "unknown_player";
    const now = Date.now();
    const points = profile.points + TOKEN_PACK.tokens;
    await ctx.db.insert("whopPayments", {
      paymentId: args.paymentId,
      deviceId: args.deviceId,
      pack: args.pack,
      tokens: TOKEN_PACK.tokens,
      createdAt: now,
    });
    await ctx.db.patch("platProfiles", profile._id, { points });
    await ctx.db.insert("platLedger", {
      deviceId: args.deviceId,
      game: "purchase",
      basePoints: TOKEN_PACK.tokens,
      multiplier: 1,
      points: TOKEN_PACK.tokens,
      ratingDelta: 0,
      ratingAfter: profile.rating,
      pointsAfter: points,
      note: `Whop purchase ${args.paymentId}`,
      createdAt: now,
    });
    return "credited";
  },
});

export const lastPurchase = query({
  args: { deviceId: v.string() },
  returns: v.union(v.null(), v.object({ tokens: v.number(), createdAt: v.number() })),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("whopPayments")
      .withIndex("by_deviceId_and_createdAt", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .first();
    return row && { tokens: row.tokens, createdAt: row.createdAt };
  },
});
