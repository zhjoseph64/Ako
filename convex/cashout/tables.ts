import { defineTable } from "convex/server";
import { v } from "convex/values";

export const rewardStatus = v.union(v.literal("available"), v.literal("reserved"), v.literal("redeemed"));
export const redemptionStatus = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("transferred"),
  v.literal("failed"),
);

export const cashoutTables = {
  cashWallets: defineTable({
    deviceId: v.string(),
    secretHash: v.string(),
    whopUserId: v.optional(v.string()),
    whopUsername: v.optional(v.string()),
    linkedAt: v.optional(v.number()),
  })
    .index("by_deviceId", ["deviceId"])
    .index("by_whopUserId", ["whopUserId"]),

  cashLinkSessions: defineTable({
    deviceId: v.string(),
    state: v.string(),
    codeVerifier: v.string(),
    returnUrl: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  }).index("by_state", ["state"]),

  cashDailyCredits: defineTable({
    deviceId: v.string(),
    day: v.string(),
    credits: v.number(),
  }).index("by_deviceId_and_day", ["deviceId", "day"]),

  cashRewards: defineTable({
    deviceId: v.string(),
    source: v.union(v.literal("unpredictable"), v.literal("jailbreak")),
    sourceKey: v.string(),
    earnedCredits: v.number(),
    credits: v.number(),
    note: v.string(),
    status: rewardStatus,
    redemptionId: v.optional(v.id("cashRedemptions")),
  })
    .index("by_sourceKey", ["sourceKey"])
    .index("by_deviceId", ["deviceId"])
    .index("by_deviceId_and_status", ["deviceId", "status"])
    .index("by_redemptionId", ["redemptionId"]),

  cashRedemptions: defineTable({
    deviceId: v.string(),
    whopUserId: v.string(),
    whopUsername: v.optional(v.string()),
    environment: v.union(v.literal("sandbox"), v.literal("production")),
    credits: v.number(),
    centsPerCredit: v.number(),
    grossCents: v.number(),
    feeCents: v.number(),
    netCents: v.number(),
    currency: v.string(),
    originId: v.string(),
    idempotencyKey: v.string(),
    status: redemptionStatus,
    needsReview: v.boolean(),
    attempts: v.number(),
    reconcileChecks: v.number(),
    whopTransferId: v.optional(v.string()),
    whopStatus: v.optional(v.string()),
    whopFee: v.optional(v.string()),
    whopTrackingUrl: v.optional(v.string()),
    failureReason: v.optional(v.string()),
    settledAt: v.optional(v.number()),
  })
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_deviceId", ["deviceId"])
    .index("by_deviceId_and_status", ["deviceId", "status"])
    .index("by_status", ["status"]),

  cashEvents: defineTable({
    redemptionId: v.id("cashRedemptions"),
    type: v.string(),
    detail: v.string(),
  }).index("by_redemptionId", ["redemptionId"]),
};
