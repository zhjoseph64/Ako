import { v } from "convex/values";

import { internalMutation, internalQuery, query } from "../_generated/server";
import { PROMPT_SETS, RUN_LENGTH } from "./seed";
import { clusterKey, dayInfo, sameAnswer } from "./text";

export const prompts = query({
  args: { now: v.number(), deviceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const deviceId = args.deviceId;
    const player = deviceId
      ? await ctx.db
          .query("unpPlayers")
          .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
          .unique()
      : null;
    const session = player
      ? await ctx.db
          .query("unpSessions")
          .withIndex("by_playerId_and_day", (q) => q.eq("playerId", player._id))
          .order("desc")
          .first()
      : null;
    const rows = session?.promptIds
      ? (
          await Promise.all(
            session.promptIds.map((id) => ctx.db.get("unpPrompts", id)),
          )
        ).filter((p) => p !== null)
      : await ctx.db
          .query("unpPrompts")
          .withIndex("by_set_and_index", (q) =>
            q.eq(
              "set",
              session?.set ?? dayInfo(args.now, PROMPT_SETS.length).set,
            ),
          )
          .take(RUN_LENGTH);
    return rows.map((p) => ({ _id: p._id, text: p.text }));
  },
});

export const distribution = query({
  args: { promptId: v.id("unpPrompts") },
  handler: async (ctx, args) => {
    const clusters = await ctx.db
      .query("unpClusters")
      .withIndex("by_promptId_and_key", (q) => q.eq("promptId", args.promptId))
      .take(500);
    const humans = clusters.reduce((sum, c) => sum + c.humanCount, 0);
    const ai = clusters.reduce((sum, c) => sum + c.aiCount, 0);
    return {
      humans,
      ai,
      clusters: clusters
        .filter((c) => c.humanCount + c.aiCount > 0)
        .sort((a, b) => b.humanCount - a.humanCount || b.aiCount - a.aiCount)
        .slice(0, 40)
        .map((c) => ({
          _id: c._id,
          label: c.label,
          humanCount: c.humanCount,
          aiCount: c.aiCount,
        })),
    };
  },
});

export const allPrompts = internalQuery({
  args: { promptIds: v.optional(v.array(v.id("unpPrompts"))) },
  handler: async (ctx, args) => {
    if (!args.promptIds) return await ctx.db.query("unpPrompts").take(100);
    const rows = await Promise.all(
      args.promptIds.map((id) => ctx.db.get("unpPrompts", id)),
    );
    return rows.filter((p) => p !== null);
  },
});

export const storeSamples = internalMutation({
  args: { promptId: v.id("unpPrompts"), answers: v.array(v.string()) },
  handler: async (ctx, args) => {
    const clusters = await ctx.db
      .query("unpClusters")
      .withIndex("by_promptId_and_key", (q) => q.eq("promptId", args.promptId))
      .take(500);
    const counts = new Map<string, { label: string; count: number }>();
    for (const answer of args.answers) {
      const exact = clusterKey(answer);
      if (!exact) continue;
      const key =
        clusters.find((c) => c.key === exact)?.key ??
        clusters.find((c) => sameAnswer(c.label, answer))?.key ??
        [...counts.entries()].find(([, entry]) =>
          sameAnswer(entry.label, answer),
        )?.[0] ??
        exact;
      const entry = counts.get(key) ?? {
        label: answer.toLowerCase(),
        count: 0,
      };
      entry.count++;
      counts.set(key, entry);
    }
    for (const cluster of clusters) {
      const aiCount = counts.get(cluster.key)?.count ?? 0;
      counts.delete(cluster.key);
      if (cluster.aiCount !== aiCount)
        await ctx.db.patch("unpClusters", cluster._id, { aiCount });
    }
    for (const [key, entry] of counts) {
      await ctx.db.insert("unpClusters", {
        promptId: args.promptId,
        key,
        label: entry.label,
        humanCount: 0,
        aiCount: entry.count,
      });
    }
    return null;
  },
});
