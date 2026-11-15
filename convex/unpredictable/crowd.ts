import { v } from "convex/values";

import { internalMutation, internalQuery, query } from "../_generated/server";
import { PROMPT_SETS } from "./seed";
import { clusterKey, dayInfo, sameAnswer } from "./text";

export const prompts = query({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    const { set } = dayInfo(args.now, PROMPT_SETS.length);
    const rows = await ctx.db
      .query("unpPrompts")
      .withIndex("by_set_and_index", (q) => q.eq("set", set))
      .take(10);
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
        .map((c) => ({ _id: c._id, label: c.label, humanCount: c.humanCount, aiCount: c.aiCount })),
    };
  },
});

export const allPrompts = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("unpPrompts").take(100);
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
        [...counts.entries()].find(([, entry]) => sameAnswer(entry.label, answer))?.[0] ??
        exact;
      const entry = counts.get(key) ?? { label: answer.toLowerCase(), count: 0 };
      entry.count++;
      counts.set(key, entry);
    }
    for (const cluster of clusters) {
      const aiCount = counts.get(cluster.key)?.count ?? 0;
      counts.delete(cluster.key);
      if (cluster.aiCount !== aiCount) await ctx.db.patch("unpClusters", cluster._id, { aiCount });
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
