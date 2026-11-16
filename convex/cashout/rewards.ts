import type { MutationCtx } from "../_generated/server";
import { CASHOUT_RULES } from "./config";

export async function awardCredits(
  ctx: MutationCtx,
  reward: { deviceId: string; source: "unpredictable" | "jailbreak"; sourceKey: string; credits: number; note: string },
) {
  const earned = Math.floor(reward.credits);
  if (earned <= 0) return null;
  const existing = await ctx.db
    .query("cashRewards")
    .withIndex("by_sourceKey", (q) => q.eq("sourceKey", reward.sourceKey))
    .unique();
  if (existing) return existing._id;
  const day = new Date().toISOString().slice(0, 10);
  const today = await ctx.db
    .query("cashDailyCredits")
    .withIndex("by_deviceId_and_day", (q) => q.eq("deviceId", reward.deviceId).eq("day", day))
    .unique();
  const credits = Math.min(earned, CASHOUT_RULES.dailyCreditCap - (today?.credits ?? 0));
  if (credits <= 0) return null;
  if (today) await ctx.db.patch("cashDailyCredits", today._id, { credits: today.credits + credits });
  else await ctx.db.insert("cashDailyCredits", { deviceId: reward.deviceId, day, credits });
  return await ctx.db.insert("cashRewards", {
    deviceId: reward.deviceId,
    source: reward.source,
    sourceKey: reward.sourceKey,
    earnedCredits: earned,
    credits,
    note: credits < earned ? `${reward.note} (daily credit cap reached)` : reward.note,
    status: "available",
  });
}
