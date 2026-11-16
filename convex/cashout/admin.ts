import { ConvexError, v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { internalQuery, query, type QueryCtx } from "../_generated/server";

const STATUSES = ["pending", "processing", "transferred", "failed"] as const;

async function buildReport(ctx: QueryCtx) {
  const rows: Doc<"cashRedemptions">[] = [];
  for (const status of STATUSES) {
    rows.push(
      ...(await ctx.db
        .query("cashRedemptions")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(50)),
    );
  }
  return {
    counts: Object.fromEntries(STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length])),
    needsReview: rows.filter((r) => r.needsReview).length,
    redemptions: rows
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((r) => ({
        _id: r._id,
        requestedAt: r._creationTime,
        status: r.status,
        needsReview: r.needsReview,
        environment: r.environment,
        deviceId: r.deviceId,
        whopUserId: r.whopUserId,
        whopUsername: r.whopUsername ?? null,
        credits: r.credits,
        netCents: r.netCents,
        attempts: r.attempts,
        whopTransferId: r.whopTransferId ?? null,
        whopStatus: r.whopStatus ?? null,
        whopFee: r.whopFee ?? null,
        failureReason: r.failureReason ?? null,
        settledAt: r.settledAt ?? null,
      })),
  };
}

export const report = query({
  args: { adminKey: v.string() },
  handler: async (ctx, args) => {
    const expected = process.env.CASHOUT_ADMIN_KEY;
    if (!expected || args.adminKey !== expected) throw new ConvexError("Not authorized.");
    return await buildReport(ctx);
  },
});

export const serverReport = internalQuery({
  args: {},
  handler: async (ctx) => await buildReport(ctx),
});

export const events = internalQuery({
  args: { redemptionId: v.id("cashRedemptions") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("cashEvents")
      .withIndex("by_redemptionId", (q) => q.eq("redemptionId", args.redemptionId))
      .take(100),
});
