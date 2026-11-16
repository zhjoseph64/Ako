import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { CREDIT_REWARDS } from "../cashout/config";
import { awardCredits } from "../cashout/rewards";
import { applyAward } from "../platform/award";
import schema from "../schema";
import { attackOutcome } from "./tables";
import { askModel, bossModelName } from "./bossAdapters";
import { evaluateReply } from "./evaluator";
import { DEFAULT_BOSS } from "./rooms";

const INNERMOST_RING = 1;
const OUTER_RING = 3;
const PUSH_BACK = 1;
const INCH_FORWARD = 0.5;
const MAX_HISTORY_TURNS = 40;

export const attackContext = internalQuery({
  args: { attackId: v.id("jbAttacks") },
  returns: v.union(
    v.null(),
    v.object({
      attack: schema.doc("jbAttacks"),
      room: schema.doc("jbRooms"),
      history: v.array(v.object({ prompt: v.string(), reply: v.string() })),
    }),
  ),
  handler: async (ctx, args) => {
    const attack = await ctx.db.get("jbAttacks", args.attackId);
    if (!attack) return null;
    const room = await ctx.db.get("jbRooms", attack.roomId);
    if (!room) return null;
    const recent: Doc<"jbAttacks">[] = await ctx.db
      .query("jbAttacks")
      .withIndex("by_roomId_and_playerId_and_round_and_chatEpoch", (q) =>
        q
          .eq("roomId", attack.roomId)
          .eq("playerId", attack.playerId)
          .eq("round", attack.round)
          .eq("chatEpoch", attack.chatEpoch)
          .lt("_creationTime", attack._creationTime),
      )
      .order("desc")
      .take(MAX_HISTORY_TURNS);
    const history = recent
      .reverse()
      .filter((turn) => turn.status === "resolved")
      .map((turn) => ({ prompt: turn.prompt, reply: turn.reply ?? "" }));
    return { attack, room, history };
  },
});

export const runAttack = internalAction({
  args: { attackId: v.id("jbAttacks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.jailbreak.engine.attackContext, args);
    if (!context || context.attack.status !== "pending") return null;
    const { attack, room, history } = context;
    const model = bossModelName();
    try {
      const reply = await askModel(room, history, attack.prompt);
      const verdict = evaluateReply(reply, room);
      await ctx.runMutation(internal.jailbreak.engine.applyResult, {
        attackId: args.attackId,
        reply,
        adapter: model,
        outcome: verdict.outcome,
        label: verdict.label,
      });
    } catch (error) {
      await ctx.runMutation(internal.jailbreak.engine.applyResult, {
        attackId: args.attackId,
        reply: `The dragon is silent. (${error instanceof Error ? error.message : "boss error"})`,
        adapter: model,
      });
    }
    return null;
  },
});

export const applyResult = internalMutation({
  args: {
    attackId: v.id("jbAttacks"),
    reply: v.string(),
    adapter: v.string(),
    outcome: v.optional(attackOutcome),
    label: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attack = await ctx.db.get("jbAttacks", args.attackId);
    if (!attack || attack.status !== "pending") return null;
    if (!args.outcome) {
      await ctx.db.patch("jbAttacks", attack._id, {
        status: "error",
        reply: args.reply,
        adapter: args.adapter,
        label: "BOSS ERROR",
        ringAfter: attack.ringBefore,
      });
      return null;
    }
    const room = await ctx.db.get("jbRooms", attack.roomId);
    const player = await ctx.db
      .query("jbPlayers")
      .withIndex("by_roomId_and_playerId", (q) =>
        q.eq("roomId", attack.roomId).eq("playerId", attack.playerId),
      )
      .unique();
    const roundIsLive = room && room.status === "active" && room.round === attack.round;
    if (!room || !player || !roundIsLive) {
      await ctx.db.patch("jbAttacks", attack._id, {
        status: "resolved",
        reply: args.reply,
        adapter: args.adapter,
        outcome: args.outcome,
        label: args.label,
        ringAfter: player?.ring ?? attack.ringBefore,
      });
      return null;
    }
    const ringAfter =
      args.outcome === "held"
        ? Math.min(OUTER_RING, player.ring + PUSH_BACK)
        : args.outcome === "partial"
          ? Math.max(INNERMOST_RING, player.ring - INCH_FORWARD)
          : player.ring;
    await ctx.db.patch("jbPlayers", player._id, { ring: ringAfter });
    let reward: { points: number; multiplier: number; credits: number } | undefined;
    if (args.outcome === "full") {
      await ctx.db.patch("jbRooms", room._id, {
        status: "defeated",
        winnerId: player.playerId,
        winnerName: player.name,
        winningAttackId: attack._id,
      });
      const standardBoss = (Object.keys(DEFAULT_BOSS) as (keyof typeof DEFAULT_BOSS)[]).every(
        (key) => room[key] === DEFAULT_BOSS[key],
      );
      const creditRewardId = standardBoss
        ? await awardCredits(ctx, {
            deviceId: player.playerId,
            source: "jailbreak",
            sourceKey: `jailbreak:${attack._id}`,
            credits: CREDIT_REWARDS.jailbreakBossDefeated,
            note: `Defeated ${room.bossName}`,
          })
        : null;
      const creditReward = creditRewardId ? await ctx.db.get("cashRewards", creditRewardId) : null;
      const points = await applyAward(ctx, {
        deviceId: player.playerId,
        name: player.name,
        game: "jailbreak",
        basePoints: 300,
        ratingDelta: 12,
        note: `Defeated ${room.bossName}`,
      });
      reward = { points, multiplier: Math.round((points / 300) * 100) / 100, credits: creditReward?.credits ?? 0 };
    } else if (args.outcome === "partial" && ringAfter < player.ring) {
      await applyAward(ctx, {
        deviceId: player.playerId,
        name: player.name,
        game: "jailbreak",
        basePoints: 80,
        ratingDelta: 3,
        note: `Cracked ${room.bossName}'s guard`,
      });
    }
    await ctx.db.patch("jbAttacks", attack._id, {
      status: "resolved",
      reply: args.reply,
      adapter: args.adapter,
      outcome: args.outcome,
      label: args.label,
      ringBefore: player.ring,
      ringAfter,
      reward,
    });
    return null;
  },
});

export const expireAttack = internalMutation({
  args: { attackId: v.id("jbAttacks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attack = await ctx.db.get("jbAttacks", args.attackId);
    if (!attack || attack.status !== "pending") return null;
    await ctx.db.patch("jbAttacks", attack._id, {
      status: "error",
      reply: "The dragon didn't answer in time. Try again.",
      label: "TIMED OUT",
      ringAfter: attack.ringBefore,
    });
    return null;
  },
});
