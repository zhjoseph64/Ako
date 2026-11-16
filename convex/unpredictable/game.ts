import { v } from "convex/values";

import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  MutationCtx,
  query,
  QueryCtx,
} from "../_generated/server";
import { CREDIT_REWARDS } from "../cashout/config";
import { awardCredits } from "../cashout/rewards";
import { applyAward } from "../platform/award";
import { PROMPT_POOL, PROMPT_SETS, RUN_LENGTH } from "./seed";
import { clusterKey, dayInfo, words } from "./text";

export const ROUND_SECONDS = 15;
export const START_LIVES = 3;
export const LIFE_POINTS = 25;
const GRACE_MS = 5000;
const PREPARE_TIMEOUT_MS = 60000;
const SAMPLE_BATCH = 10;

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

async function ownedRound(
  ctx: QueryCtx,
  deviceId: string,
  roundId: Doc<"unpRounds">["_id"],
) {
  const player = await playerByDevice(ctx, deviceId);
  const round = await ctx.db.get("unpRounds", roundId);
  if (!player || !round || round.playerId !== player._id) return null;
  return round;
}

export const join = mutation({
  args: { deviceId: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const name = args.name.trim().slice(0, 20);
    if (!name || args.deviceId.length < 8)
      throw new Error("A name is required");
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
    const latest = await latestSession(ctx, args.deviceId);
    if (!latest) throw new Error("Join first");
    const { player, session: current, rounds } = latest;
    if (
      current?.status === "preparing" &&
      Date.now() - current._creationTime < PREPARE_TIMEOUT_MS
    ) {
      return null;
    }
    if (
      current?.status === "ready" &&
      rounds.some((r) => r.outcome === undefined)
    )
      return null;

    const pool = await ctx.db.query("unpPrompts").take(1000);
    const known = new Set(pool.map((p) => p.text));
    const promptIds = pool.map((p) => p._id);
    const added: Id<"unpPrompts">[] = [];
    for (const [i, prompt] of PROMPT_POOL.entries()) {
      if (known.has(prompt.text)) continue;
      added.push(
        await ctx.db.insert("unpPrompts", {
          set: Math.floor(i / RUN_LENGTH),
          index: i % RUN_LENGTH,
          ...prompt,
        }),
      );
    }
    for (let i = 0; i < added.length; i += SAMPLE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.unpredictable.ai.sampleAll, {
        promptIds: added.slice(i, i + SAMPLE_BATCH),
      });
    }
    promptIds.push(...added);

    const history = await ctx.db
      .query("unpRounds")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .order("desc")
      .take(2000);
    const lastSeen = new Map<Id<"unpPrompts">, number>();
    for (const round of history) {
      if (round.status !== "sealed" && !lastSeen.has(round.promptId)) {
        lastSeen.set(round.promptId, round._creationTime);
      }
    }
    const shuffled = promptIds
      .map((id) => ({ id, order: Math.random() }))
      .sort((x, y) => x.order - y.order)
      .map((entry) => entry.id);
    const unseen = shuffled.filter((id) => !lastSeen.has(id));
    const seen = shuffled
      .filter((id) => lastSeen.has(id))
      .sort((x, y) => lastSeen.get(x)! - lastSeen.get(y)!);

    const { day, set } = dayInfo(Date.now(), PROMPT_SETS.length);
    const sessionId = await ctx.db.insert("unpSessions", {
      playerId: player._id,
      day,
      set,
      status: "preparing",
      lives: START_LIVES,
      promptIds: [...unseen, ...seen].slice(0, RUN_LENGTH),
    });
    await ctx.scheduler.runAfter(0, internal.unpredictable.ai.prepare, {
      sessionId,
    });
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
        lives: session.lives ?? START_LIVES,
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
    const session = await ctx.db.get("unpSessions", round.sessionId);
    if (!session || session.status !== "ready") return null;
    const earlier = await ctx.db
      .query("unpRounds")
      .withIndex("by_sessionId_and_index", (q) =>
        q.eq("sessionId", round.sessionId).lt("index", round.index),
      )
      .take(20);
    if (earlier.some((r) => r.status !== "done"))
      throw new Error("Finish the previous round first");
    await ctx.db.patch("unpRounds", round._id, {
      status: "open",
      startedAt: Date.now(),
    });
    return null;
  },
});

export const submit = mutation({
  args: {
    deviceId: v.string(),
    roundId: v.id("unpRounds"),
    answer: v.string(),
  },
  handler: async (ctx, args) => {
    const round = await ownedRound(ctx, args.deviceId, args.roundId);
    if (!round || round.status !== "open") return null;
    const answer = args.answer.trim().replace(/\s+/g, " ").slice(0, 60);
    const count = words(answer).length;
    const late =
      Date.now() > (round.startedAt ?? 0) + ROUND_SECONDS * 1000 + GRACE_MS;
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
      await awardFinishedSession(ctx, round.sessionId);
      return null;
    }
    await ctx.db.patch("unpRounds", round._id, { status: "judging", answer });
    await ctx.scheduler.runAfter(0, internal.unpredictable.ai.judge, {
      roundId: round._id,
    });
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
    const mine = await ctx.db.get("unpClusters", round.clusterId);
    if (!mine) return null;
    const total = clusters.reduce((sum, c) => sum + c.humanCount, 0);
    return {
      label: mine.label,
      count: mine.humanCount,
      total,
      percent: Math.max(
        1,
        Math.round((mine.humanCount / Math.max(total, 1)) * 100),
      ),
      bonus: round.outcome === "escaped" && mine.humanCount >= 2,
    };
  },
});

export const ESCAPE_POINTS = 100;
export const CROWD_BONUS_POINTS = 50;

async function scoreSession(
  ctx: QueryCtx,
  session: Doc<"unpSessions">,
  sessionRounds: Doc<"unpRounds">[],
) {
  const rounds = [];
  for (const round of sessionRounds) {
    const cluster = round.clusterId
      ? await ctx.db.get("unpClusters", round.clusterId)
      : null;
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
  const over = session.status === "over";
  const lives = session.lives ?? START_LIVES;
  const finished =
    over || (rounds.length > 0 && rounds.every((r) => r.outcome !== null));
  const survived = finished && !over;
  return {
    day: session.day,
    finished,
    over,
    lives,
    played: rounds.filter((r) => r.outcome !== null).length,
    total: rounds.length,
    predicted: rounds.filter((r) => r.outcome === "predicted").length,
    escaped,
    bonus,
    lifePoints: survived ? lives * LIFE_POINTS : 0,
    points:
      escaped * ESCAPE_POINTS +
      bonus * CROWD_BONUS_POINTS +
      (survived ? lives * LIFE_POINTS : 0),
    rounds,
  };
}

async function awardFinishedSession(
  ctx: MutationCtx,
  sessionId: Id<"unpSessions">,
) {
  const session = await ctx.db.get("unpSessions", sessionId);
  const player = session && (await ctx.db.get("unpPlayers", session.playerId));
  if (!session || !player) return;
  const rounds = await ctx.db
    .query("unpRounds")
    .withIndex("by_sessionId_and_index", (q) => q.eq("sessionId", session._id))
    .take(20);
  const score = await scoreSession(ctx, session, rounds);
  if (!score.finished) return;
  await awardCredits(ctx, {
    deviceId: player.deviceId,
    source: "unpredictable",
    sourceKey: `unpredictable:${session._id}`,
    credits: score.points * CREDIT_REWARDS.unpredictableCreditsPerPoint,
    note: `Unpredictable run ${session.day}: ${score.escaped} escaped`,
  });
  if (score.lifePoints > 0) {
    await applyAward(ctx, {
      deviceId: player.deviceId,
      name: player.name,
      game: "unpredictable",
      basePoints: score.lifePoints,
      ratingDelta: 0,
      note: `Survived with ${score.lives} ${score.lives === 1 ? "life" : "lives"}`,
    });
  }
}

export const summary = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const found = await latestSession(ctx, args.deviceId);
    if (!found?.session) return null;
    return {
      name: found.player.name,
      ...(await scoreSession(ctx, found.session, found.rounds)),
    };
  },
});

export const prepareContext = internalQuery({
  args: { sessionId: v.id("unpSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get("unpSessions", args.sessionId);
    if (!session) throw new Error("Session not found");
    const picked = session.promptIds
      ? await Promise.all(
          session.promptIds.map((id) => ctx.db.get("unpPrompts", id)),
        )
      : await ctx.db
          .query("unpPrompts")
          .withIndex("by_set_and_index", (q) => q.eq("set", session.set))
          .take(RUN_LENGTH);
    return {
      playerId: session.playerId,
      prompts: picked
        .filter((p) => p !== null)
        .map((p, index) => ({
          _id: p._id,
          index,
          text: p.text,
          common: p.common,
        })),
    };
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
    return {
      round,
      day: session?.day ?? "",
      clusters: clusters.map((c) => c.label),
    };
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
      await awardFinishedSession(ctx, round.sessionId);
      return null;
    }
    const key =
      clusterKey(args.cluster) || clusterKey(round.answer ?? "") || "other";
    const existing = await ctx.db
      .query("unpClusters")
      .withIndex("by_promptId_and_key", (q) =>
        q.eq("promptId", round.promptId).eq("key", key),
      )
      .first();
    const clusterId =
      existing?._id ??
      (await ctx.db.insert("unpClusters", {
        promptId: round.promptId,
        key,
        label: args.cluster.toLowerCase(),
        humanCount: 0,
        aiCount: 0,
      }));
    const counted = await ctx.db
      .query("unpClusterPlayers")
      .withIndex("by_clusterId_and_playerId", (q) =>
        q.eq("clusterId", clusterId).eq("playerId", round.playerId),
      )
      .first();
    if (!counted) {
      await ctx.db.insert("unpClusterPlayers", {
        clusterId,
        playerId: round.playerId,
      });
      await ctx.db.patch("unpClusters", clusterId, {
        humanCount: (existing?.humanCount ?? 0) + 1,
      });
    }
    const byCluster = round.guesses.findIndex((g) => clusterKey(g) === key);
    const matchedGuess =
      args.matchedGuess ?? (byCluster === -1 ? null : byCluster);
    const session = await ctx.db.get("unpSessions", round.sessionId);
    if (matchedGuess !== null && session) {
      const lives = Math.max(0, (session.lives ?? START_LIVES) - 1);
      await ctx.db.patch("unpSessions", session._id, {
        lives,
        status: lives === 0 ? "over" : session.status,
      });
    }
    const escaped = matchedGuess === null;
    await ctx.db.patch("unpRounds", round._id, {
      status: "done",
      outcome: escaped ? "escaped" : "predicted",
      matchedGuess: matchedGuess ?? undefined,
      clusterId,
    });
    await awardFinishedSession(ctx, round.sessionId);
    const player = await ctx.db.get("unpPlayers", round.playerId);
    if (player) {
      await applyAward(ctx, {
        deviceId: player.deviceId,
        name: player.name,
        game: "unpredictable",
        basePoints: escaped ? ESCAPE_POINTS : 0,
        ratingDelta: escaped ? 6 : -4,
        note: `${escaped ? "Escaped" : "Predicted"}: ${round.promptText}`,
      });
    }
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
        .withIndex("by_sessionId_and_index", (q) =>
          q.eq("sessionId", session._id),
        )
        .take(20);
      for (const round of rounds) {
        const counted = round.clusterId
          ? await ctx.db
              .query("unpClusterPlayers")
              .withIndex("by_clusterId_and_playerId", (q) =>
                q.eq("clusterId", round.clusterId!).eq("playerId", player._id),
              )
              .first()
          : null;
        const cluster = counted
          ? await ctx.db.get("unpClusters", counted.clusterId)
          : null;
        if (counted && cluster) {
          await ctx.db.delete("unpClusterPlayers", counted._id);
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
