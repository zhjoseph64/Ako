import { v } from "convex/values";

import { internal } from "../_generated/api";
import { Doc } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  QueryCtx,
} from "../_generated/server";
import { PROMPT_SETS } from "./seed";
import { clusterKey, dayInfo, words } from "./text";

export const ROUND_SECONDS = 15;
const GRACE_MS = 5000;

async function playerByDevice(ctx: QueryCtx, deviceId: string) {
  return await ctx.db
    .query("unpPlayers")
    .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
    .unique();
}

async function latestSession(ctx: QueryCtx, deviceId: string) {
  const player = await playerByDevice(ctx, deviceId);
  if (!player) return null;
  const session = await ctx.db
    .query("unpSessions")
    .withIndex("by_playerId_and_day", (q) => q.eq("playerId", player._id))
    .order("desc")
    .first();
  if (!session) return { player, session: null, rounds: [] };
  const rounds = await ctx.db
    .query("unpRounds")
    .withIndex("by_sessionId_and_index", (q) => q.eq("sessionId", session._id))
    .take(20);
  return { player, session, rounds };
}

async function ownedRound(ctx: QueryCtx, deviceId: string, roundId: Doc<"unpRounds">["_id"]) {
  const player = await playerByDevice(ctx, deviceId);
  const round = await ctx.db.get("unpRounds", roundId);
  if (!player || !round || round.playerId !== player._id) return null;
  return round;
}

export const join = mutation({
  args: { deviceId: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const name = args.name.trim().slice(0, 20);
    if (!name || args.deviceId.length < 8) throw new Error("A name is required");
    const player = await playerByDevice(ctx, args.deviceId);
    if (player) {
      await ctx.db.patch("unpPlayers", player._id, { name });
      return null;
    }
    await ctx.db.insert("unpPlayers", { deviceId: args.deviceId, name });
    return null;
  },
});

export const start = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const player = await playerByDevice(ctx, args.deviceId);
    if (!player) throw new Error("Join first");
    const { day, set } = dayInfo(Date.now(), PROMPT_SETS.length);
    const existing = await ctx.db
      .query("unpSessions")
      .withIndex("by_playerId_and_day", (q) => q.eq("playerId", player._id).eq("day", day))
      .unique();
    if (existing) return null;

    const seeded = await ctx.db.query("unpPrompts").first();
    if (!seeded) {
      for (const [setIndex, prompts] of PROMPT_SETS.entries()) {
        for (const [index, prompt] of prompts.entries()) {
          await ctx.db.insert("unpPrompts", { set: setIndex, index, ...prompt });
        }
      }
      await ctx.scheduler.runAfter(0, internal.unpredictable.ai.sampleAll, {});
    }

    const sessionId = await ctx.db.insert("unpSessions", {
      playerId: player._id,
      day,
      set,
      status: "preparing",
    });
    await ctx.scheduler.runAfter(0, internal.unpredictable.ai.prepare, { sessionId });
    return null;
  },
});

export const session = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const found = await latestSession(ctx, args.deviceId);
    if (!found) return null;
    const { player, session, rounds } = found;
    return {
      name: player.name,
      session: session && {
        day: session.day,
        status: session.status,
        rounds: rounds.map((round) => ({
          _id: round._id,
          index: round.index,
          status: round.status,
          prompt: round.status === "sealed" ? null : round.promptText,
          startedAt: round.startedAt ?? null,
          answer: round.answer ?? null,
          outcome: round.outcome ?? null,
          judgeReason: round.judgeReason ?? null,
          reveal:
            round.status === "done"
              ? {
                  guesses: round.guesses,
                  matchedGuess: round.matchedGuess ?? null,
                  reason: round.reason,
                  usedMemory: round.usedMemory,
                }
              : null,
        })),
      },
    };
  },
});

export const beginRound = mutation({
  args: { deviceId: v.string(), roundId: v.id("unpRounds") },
  handler: async (ctx, args) => {
    const round = await ownedRound(ctx, args.deviceId, args.roundId);
    if (!round || round.status !== "sealed") return null;
    const earlier = await ctx.db
      .query("unpRounds")
      .withIndex("by_sessionId_and_index", (q) =>
        q.eq("sessionId", round.sessionId).lt("index", round.index),
      )
      .take(20);
    if (earlier.some((r) => r.status !== "done")) throw new Error("Finish the previous round first");
    await ctx.db.patch("unpRounds", round._id, { status: "open", startedAt: Date.now() });
    return null;
  },
});

export const submit = mutation({
  args: { deviceId: v.string(), roundId: v.id("unpRounds"), answer: v.string() },
  handler: async (ctx, args) => {
    const round = await ownedRound(ctx, args.deviceId, args.roundId);
    if (!round || round.status !== "open") return null;
    const answer = args.answer.trim().replace(/\s+/g, " ").slice(0, 60);
    const count = words(answer).length;
    const late = Date.now() > (round.startedAt ?? 0) + ROUND_SECONDS * 1000 + GRACE_MS;
    const rejection =
      count === 0
        ? "Time ran out before you answered."
        : late
          ? "Too slow: the 15 seconds were up."
          : count > 4
            ? "Keep it to four words."
            : null;
    if (rejection) {
      await ctx.db.patch("unpRounds", round._id, {
        status: "done",
        answer,
        outcome: "void",
        judgeReason: rejection,
      });
      return null;
    }
    await ctx.db.patch("unpRounds", round._id, { status: "judging", answer });
    await ctx.scheduler.runAfter(0, internal.unpredictable.ai.judge, { roundId: round._id });
    return null;
  },
});

export const roundCrowd = query({
  args: { deviceId: v.string(), roundId: v.id("unpRounds") },
  handler: async (ctx, args) => {
    const round = await ownedRound(ctx, args.deviceId, args.roundId);
    if (!round || !round.clusterId) return null;
    const clusters = await ctx.db
      .query("unpClusters")
      .withIndex("by_promptId_and_key", (q) => q.eq("promptId", round.promptId))
      .take(500);
    const mine = clusters.find((c) => c._id === round.clusterId);
    if (!mine) return null;
    const total = clusters.reduce((sum, c) => sum + c.humanCount, 0);
    return {
      label: mine.label,
      count: mine.humanCount,
      total,
      percent: Math.max(1, Math.round((mine.humanCount / Math.max(total, 1)) * 100)),
      bonus: round.outcome === "escaped" && mine.humanCount >= 2,
    };
  },
});

export const ESCAPE_POINTS = 100;
export const CROWD_BONUS_POINTS = 50;

export const summary = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const found = await latestSession(ctx, args.deviceId);
    if (!found?.session) return null;
    const rounds = [];
    for (const round of found.rounds) {
      const cluster = round.clusterId ? await ctx.db.get("unpClusters", round.clusterId) : null;
      rounds.push({
        index: round.index,
        prompt: round.promptText,
        answer: round.answer ?? null,
        outcome: round.outcome ?? null,
        bonus: round.outcome === "escaped" && (cluster?.humanCount ?? 0) >= 2,
      });
    }
    const escaped = rounds.filter((r) => r.outcome === "escaped").length;
    const bonus = rounds.filter((r) => r.bonus).length;
    return {
      name: found.player.name,
      day: found.session.day,
      finished: rounds.length > 0 && rounds.every((r) => r.outcome !== null),
      total: rounds.length,
      predicted: rounds.filter((r) => r.outcome === "predicted").length,
      escaped,
      bonus,
      points: escaped * ESCAPE_POINTS + bonus * CROWD_BONUS_POINTS,
      rounds,
    };
  },
});

export const prepareContext = internalQuery({
  args: { sessionId: v.id("unpSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get("unpSessions", args.sessionId);
    if (!session) throw new Error("Session not found");
    const prompts = await ctx.db
      .query("unpPrompts")
      .withIndex("by_set_and_index", (q) => q.eq("set", session.set))
      .take(10);
    return { playerId: session.playerId, prompts };
  },
});

export const storeRounds = internalMutation({
  args: {
    sessionId: v.id("unpSessions"),
    rounds: v.array(
      v.object({
        promptId: v.id("unpPrompts"),
        index: v.number(),
        promptText: v.string(),
        guesses: v.array(v.string()),
        reason: v.string(),
        usedMemory: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get("unpSessions", args.sessionId);
    if (!session || session.status !== "preparing") return null;
    for (const round of args.rounds) {
      await ctx.db.insert("unpRounds", {
        ...round,
        sessionId: session._id,
        playerId: session.playerId,
        status: "sealed",
      });
    }
    await ctx.db.patch("unpSessions", session._id, { status: "ready" });
    return null;
  },
});

export const judgeContext = internalQuery({
  args: { roundId: v.id("unpRounds") },
  handler: async (ctx, args) => {
    const round = await ctx.db.get("unpRounds", args.roundId);
    if (!round) throw new Error("Round not found");
    const session = await ctx.db.get("unpSessions", round.sessionId);
    const clusters = await ctx.db
      .query("unpClusters")
      .withIndex("by_promptId_and_key", (q) => q.eq("promptId", round.promptId))
      .take(200);
    return { round, day: session?.day ?? "", clusters: clusters.map((c) => c.label) };
  },
});

export const finalizeRound = internalMutation({
  args: {
    roundId: v.id("unpRounds"),
    valid: v.boolean(),
    reason: v.string(),
    matchedGuess: v.union(v.number(), v.null()),
    cluster: v.string(),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get("unpRounds", args.roundId);
    if (!round || round.status !== "judging") return null;
    if (!args.valid) {
      await ctx.db.patch("unpRounds", round._id, {
        status: "done",
        outcome: "void",
        judgeReason: args.reason || "That doesn't really answer the prompt.",
      });
      return null;
    }
    const key = clusterKey(args.cluster) || clusterKey(round.answer ?? "") || "other";
    const existing = await ctx.db
      .query("unpClusters")
      .withIndex("by_promptId_and_key", (q) => q.eq("promptId", round.promptId).eq("key", key))
      .first();
    let clusterId = existing?._id;
    if (existing) {
      await ctx.db.patch("unpClusters", existing._id, { humanCount: existing.humanCount + 1 });
    } else {
      clusterId = await ctx.db.insert("unpClusters", {
        promptId: round.promptId,
        key,
        label: args.cluster.toLowerCase(),
        humanCount: 1,
        aiCount: 0,
      });
    }
    const byCluster = round.guesses.findIndex((g) => clusterKey(g) === key);
    const matchedGuess = args.matchedGuess ?? (byCluster === -1 ? null : byCluster);
    await ctx.db.patch("unpRounds", round._id, {
      status: "done",
      outcome: matchedGuess === null ? "escaped" : "predicted",
      matchedGuess: matchedGuess ?? undefined,
      clusterId,
    });
    return null;
  },
});

export const devReset = internalMutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const players = await ctx.db.query("unpPlayers").take(500);
    let removed = 0;
    for (const player of players.filter((p) => p.name === args.name)) {
      const session = await ctx.db
        .query("unpSessions")
        .withIndex("by_playerId_and_day", (q) => q.eq("playerId", player._id))
        .order("desc")
        .first();
      if (!session) continue;
      const rounds = await ctx.db
        .query("unpRounds")
        .withIndex("by_sessionId_and_index", (q) => q.eq("sessionId", session._id))
        .take(20);
      for (const round of rounds) {
        const cluster = round.clusterId ? await ctx.db.get("unpClusters", round.clusterId) : null;
        if (cluster) {
          await ctx.db.patch("unpClusters", cluster._id, {
            humanCount: Math.max(0, cluster.humanCount - 1),
          });
        }
        await ctx.db.delete("unpRounds", round._id);
      }
      await ctx.db.delete("unpSessions", session._id);
      removed++;
    }
    return removed;
  },
});
