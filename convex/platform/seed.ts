import { v } from "convex/values";

import { internalMutation } from "../_generated/server";
import { addWeeklyPoints, applyAward, DAY_MS, dayKey, ensureProfile, weekStart } from "./award";
import { rankFor } from "./ranks";

const FAKE_PLAYERS: [string, number, string][] = [
  ["nova", 3620, "#F0A9DC"],
  ["kairo", 3240, "#8E9BF0"],
  ["mxl", 2910, "#79E2D6"],
  ["juniper", 2780, "#B9A6FF"],
  ["static.wav", 2540, "#FF9A85"],
  ["orbit", 2310, "#9FD9E6"],
  ["lumen", 2160, "#F0A9DC"],
  ["pixelmoth", 1990, "#B9A6FF"],
  ["hexa", 1840, "#8E9BF0"],
  ["quietfox", 1720, "#79E2D6"],
  ["byte_bard", 1600, "#FF9A85"],
  ["sable", 1480, "#9FD9E6"],
  ["tango", 1350, "#F0A9DC"],
  ["wren", 1210, "#B9A6FF"],
  ["delta9", 1090, "#8E9BF0"],
  ["mochi", 960, "#79E2D6"],
  ["ivo", 820, "#FF9A85"],
  ["paperplane", 640, "#9FD9E6"],
  ["glint", 480, "#F0A9DC"],
  ["sol", 300, "#B9A6FF"],
];

export const run = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const since = weekStart(Date.now());
    const alreadySeeded = await ctx.db
      .query("platLedger")
      .withIndex("by_deviceId_and_createdAt", (q) => q.eq("deviceId", "seed_00").gte("createdAt", since))
      .first();
    if (alreadySeeded) return "Already seeded this week";
    for (const [index, [name, rating, color]] of FAKE_PLAYERS.entries()) {
      const deviceId = `seed_${String(index).padStart(2, "0")}`;
      const existing = await ctx.db
        .query("platProfiles")
        .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
        .unique();
      if (existing) {
        await ctx.db.patch("platProfiles", existing._id, { rating });
      } else {
        await ctx.db.insert("platProfiles", {
          deviceId,
          name,
          avatar: { color, frame: "none", aura: "none" },
          rating,
          points: 0,
          cashedOutCents: 0,
          streakDays: 0,
        });
      }
      const rounds = 3 + ((FAKE_PLAYERS.length - index) % 7) + Math.floor((FAKE_PLAYERS.length - index) / 2);
      for (let round = 0; round < rounds; round++) {
        const jailbreak = round % 4 === 3;
        await applyAward(ctx, {
          deviceId,
          game: jailbreak ? "jailbreak" : "unpredictable",
          basePoints: jailbreak ? 300 : 120,
          ratingDelta: 0,
          note: "Seed",
        });
      }
    }
    return `Seeded ${FAKE_PLAYERS.length} players`;
  },
});

const DEMO_NOTE = "Demo history";
const DEMO_PROMPTS = [
  "Name something you'd find at the bottom of the ocean",
  "A reason to be late that nobody would question",
  "The worst possible name for a pet goldfish",
  "Something you shouldn't say in an elevator",
  "An invention the world does not need",
  "What a squid dreams about",
  "The title of your unwritten memoir",
];
const DEMO_SESSION_HOURS = [9.2, 12.8, 17.5, 21.3];
const DEMO_ROUGH_SESSIONS = new Set([2, 6, 7, 13, 18, 19, 26]);
const DEMO_CASH_OUT = 5000;

export const demoHistory = internalMutation({
  args: { deviceId: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const profile = await ensureProfile(ctx, args.deviceId);
    const existing = await ctx.db
      .query("platLedger")
      .withIndex("by_deviceId_and_createdAt", (q) => q.eq("deviceId", args.deviceId))
      .take(2001);
    if (existing.length > 2000) throw new Error("This device has too much history to back-fill");
    if (existing.some((row) => row.note.startsWith(DEMO_NOTE))) return "This device already has demo history";

    let seed = 0;
    for (const char of args.deviceId) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const now = Date.now();
    const end = Math.min(now, (existing[0]?.createdAt ?? now) - 5 * 60_000);
    const start = end - 7 * DAY_MS;
    let rating = existing.length ? existing[0].ratingAfter - existing[0].ratingDelta : profile.rating;
    let points = existing.length ? existing[0].pointsAfter - existing[0].points : profile.points;
    const before = { rating, points };
    const weekly = new Map<number, number>();
    let rows = 0;

    const write = async (game: "unpredictable" | "jailbreak" | "cashout", basePoints: number, delta: number, note: string, createdAt: number) => {
      const multiplier = game === "cashout" ? 1 : rankFor(rating).multiplier;
      const earned = Math.round(basePoints * multiplier);
      const next = Math.max(0, rating + delta);
      points += earned;
      await ctx.db.insert("platLedger", {
        deviceId: args.deviceId,
        game,
        basePoints,
        multiplier,
        points: earned,
        ratingDelta: next - rating,
        ratingAfter: next,
        pointsAfter: points,
        note: `${DEMO_NOTE}: ${note}`,
        createdAt,
      });
      rating = next;
      rows++;
      if (earned > 0) weekly.set(weekStart(createdAt), (weekly.get(weekStart(createdAt)) ?? 0) + earned);
    };

    let session = 0;
    let cashedOut = 0;
    for (let day = 0; day < 7; day++) {
      if (day === 4 && points - before.points > DEMO_CASH_OUT) {
        await write("cashout", -DEMO_CASH_OUT, 0, "Demo cash-out", start + day * DAY_MS + 8 * 3_600_000);
        cashedOut = DEMO_CASH_OUT;
      }
      for (const hour of DEMO_SESSION_HOURS) {
        const at = start + day * DAY_MS + hour * 3_600_000 + Math.floor(random() * 40 * 60_000);
        if (at >= end) continue;
        const escapeRate = DEMO_ROUGH_SESSIONS.has(session) ? 0.1 : 0.78;
        session++;
        if (session % 5 === 0) {
          const cracks = 1 + Math.floor(random() * 3);
          for (let crack = 0; crack < cracks; crack++) {
            await write("jailbreak", 80, 3, "Cracked Cinder the Nameless's guard", at + crack * 70_000);
          }
          if (random() < 0.6) await write("jailbreak", 300, 12, "Defeated Cinder the Nameless", at + cracks * 70_000);
          continue;
        }
        for (const [index, prompt] of DEMO_PROMPTS.entries()) {
          const escaped = random() < escapeRate;
          await write("unpredictable", escaped ? 120 : 0, escaped ? 6 : -4, `${escaped ? "Escaped" : "Predicted"}: ${prompt}`, at + index * 45_000);
        }
      }
    }

    const ratingShift = rating - before.rating;
    const pointsShift = points - before.points;
    for (const row of existing) {
      await ctx.db.patch("platLedger", row._id, {
        ratingAfter: row.ratingAfter + ratingShift,
        pointsAfter: row.pointsAfter + pointsShift,
      });
    }
    await ctx.db.patch("platProfiles", profile._id, {
      rating: profile.rating + ratingShift,
      points: profile.points + pointsShift,
      cashedOutCents: profile.cashedOutCents + cashedOut,
      streakDays: Math.max(profile.streakDays, 7),
      lastPlayedDay: profile.lastPlayedDay ?? dayKey(end),
    });
    for (const [week, earned] of weekly) await addWeeklyPoints(ctx, args.deviceId, week, earned);
    return `Added ${rows} demo ledger rows: rating ${before.rating} to ${rating}, +${pointsShift} points`;
  },
});
