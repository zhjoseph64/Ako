import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { judgeAnswer, predictDay, sampleAnswers } from "./llm";
import { recall, remember } from "./memory";
import { AI_SAMPLE_COUNT } from "./seed";

export const prepare = internalAction({
  args: { sessionId: v.id("unpSessions") },
  handler: async (ctx, args) => {
    const { playerId, prompts } = await ctx.runQuery(
      internal.unpredictable.game.prepareContext,
      args,
    );
    const memories = await Promise.all(
      prompts.map((p) => recall(playerId, p.text)),
    );
    const predictions = await predictDay(
      prompts.map((p, i) => ({
        text: p.text,
        common: p.common,
        memories: memories[i],
      })),
    );
    await ctx.runMutation(internal.unpredictable.game.storeRounds, {
      sessionId: args.sessionId,
      rounds: prompts.map((p, i) => ({
        promptId: p._id,
        index: p.index,
        promptText: p.text,
        ...predictions[i],
      })),
    });
    return null;
  },
});

export const judge = internalAction({
  args: { roundId: v.id("unpRounds") },
  handler: async (ctx, args) => {
    const { round, day, clusters } = await ctx.runQuery(
      internal.unpredictable.game.judgeContext,
      args,
    );
    const answer = round.answer ?? "";
    const verdict = await judgeAnswer({
      prompt: round.promptText,
      answer,
      guesses: round.guesses,
      clusters,
    });
    await ctx.runMutation(internal.unpredictable.game.finalizeRound, {
      roundId: round._id,
      ...verdict,
    });
    if (verdict.valid) {
      await remember(round.playerId, round._id, {
        prompt: round.promptText,
        answer,
        day,
      });
    }
    return null;
  },
});

export const sampleAll = internalAction({
  args: { promptIds: v.optional(v.array(v.id("unpPrompts"))) },
  handler: async (ctx, args) => {
    const prompts = await ctx.runQuery(
      internal.unpredictable.crowd.allPrompts,
      args,
    );
    for (const prompt of prompts) {
      const answers = await sampleAnswers(prompt, AI_SAMPLE_COUNT);
      await ctx.runMutation(internal.unpredictable.crowd.storeSamples, {
        promptId: prompt._id,
        answers,
      });
    }
    return null;
  },
});
