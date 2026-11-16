/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { DEFAULT_BOSS } from "./jailbreak/rooms";
import schema from "./schema";
import { awardCredits } from "./cashout/rewards";

const modules = import.meta.glob("./**/*.*s");

const PLAYER = { deviceId: "dev_player0001", secret: "a".repeat(48) };
const OTHER = { deviceId: "dev_player0002", secret: "b".repeat(48) };
const WHOP_USER = "user_player123";
const RETURN_URL = "exp://192.168.1.20:8081/--/earnings";

type Call = { url: string; method: string; headers: Record<string, string>; body: string };
type Responder = (call: Call) => Response | Promise<Response>;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function transfer(status: string, extra: Record<string, unknown> = {}) {
  return {
    object: "transfer",
    id: "ctt_test1",
    status,
    destination: { id: WHOP_USER },
    amount: status === "succeeded" ? { amount: "6.00", currency: "usd", decimals: 2, display_decimals: 2 } : null,
    fee: { amount: "0.00", currency: "usd", decimals: 2, display_decimals: 2 },
    tracking_url: "https://sandbox.whop.com/ctt_test1/",
    ...extra,
  };
}

let calls: Call[] = [];

function mockWhop(responder: Responder) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const call: Call = {
        url: String(input),
        method: init?.method ?? "GET",
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
        body: typeof init?.body === "string" ? init.body : "",
      };
      calls.push(call);
      return await responder(call);
    }),
  );
}

const posts = () => calls.filter((c) => c.method === "POST" && c.url.endsWith("/transfers"));

function happyWhop(): Responder {
  return (call) =>
    call.method === "POST" ? json(201, transfer("processing")) : json(200, transfer("succeeded"));
}

async function settle(t: ReturnType<typeof convexTest>) {
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

async function setupPlayer(t: ReturnType<typeof convexTest>, opts: { credits?: number; linked?: boolean } = {}) {
  await t.mutation(api.cashout.wallet.claimWallet, PLAYER);
  if (opts.linked !== false) {
    await t.mutation(internal.cashout.wallet.completeLink, {
      deviceId: PLAYER.deviceId,
      whopUserId: WHOP_USER,
      whopUsername: "player",
    });
  }
  if (opts.credits) {
    await t.run(async (ctx) => {
      await awardCredits(ctx, {
        deviceId: PLAYER.deviceId,
        source: "jailbreak",
        sourceKey: "jailbreak:seed",
        credits: opts.credits!,
        note: "seed",
      });
    });
  }
}

const earnings = (t: ReturnType<typeof convexTest>) => t.query(api.cashout.wallet.earnings, PLAYER);

beforeEach(() => {
  vi.useFakeTimers();
  process.env.WHOP_API_KEY = "test_key";
  process.env.WHOP_COMPANY_ID = "biz_ako";
  process.env.WHOP_CLIENT_ID = "app_ako";
  process.env.WHOP_ENVIRONMENT = "sandbox";
  process.env.CONVEX_SITE_URL = "https://ako.convex.site";
  process.env.CASHOUT_ADMIN_KEY = "admin-secret";
  delete process.env.CASHOUT_LIVE_TRANSFERS;
  delete process.env.WHOP_CLIENT_SECRET;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("wallet", () => {
  test("a public game identity can't be claimed without its game secret", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const roomId = await ctx.db.insert("jbRooms", {
        code: "ROOM",
        hostId: PLAYER.deviceId,
        ...DEFAULT_BOSS,
        status: "active",
        round: 1,
      });
      await ctx.db.insert("jbPlayers", {
        roomId,
        playerId: PLAYER.deviceId,
        secret: PLAYER.secret,
        name: "victim",
        ring: 2,
        slot: 0,
        chatEpoch: 0,
        lastSeen: Date.now(),
      });
    });
    await expect(
      t.mutation(api.cashout.wallet.claimWallet, { deviceId: PLAYER.deviceId, secret: OTHER.secret }),
    ).rejects.toThrow(/belongs to another device/);
    await t.mutation(api.cashout.wallet.claimWallet, PLAYER);

    await t.mutation(api.platform.profile.ensure, OTHER);
    await expect(
      t.mutation(api.cashout.wallet.claimWallet, { deviceId: OTHER.deviceId, secret: PLAYER.secret }),
    ).rejects.toThrow(/belongs to another device/);
  });

  test("a wallet only answers to the device secret that claimed it", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.cashout.wallet.claimWallet, PLAYER);
    await expect(
      t.query(api.cashout.wallet.earnings, { deviceId: PLAYER.deviceId, secret: "x".repeat(48) }),
    ).rejects.toThrow(/another device/);
    await expect(
      t.mutation(api.cashout.wallet.claimWallet, { deviceId: PLAYER.deviceId, secret: "x".repeat(48) }),
    ).rejects.toThrow(/another device/);
  });
});

describe("Whop account linking", () => {
  test("links through OAuth with PKCE and rejects a replayed or reused link", async () => {
    const t = convexTest(schema, modules);
    await setupPlayer(t, { linked: false });
    mockWhop((call) =>
      call.url.endsWith("/oauth/token")
        ? json(200, { access_token: "user_token", token_type: "bearer", expires_in: 3600 })
        : json(200, { sub: WHOP_USER, preferred_username: "player" }),
    );

    const authorize = new URL(
      await t.mutation(api.cashout.wallet.startWhopLink, { ...PLAYER, returnUrl: RETURN_URL }),
    );
    expect(authorize.origin + authorize.pathname).toBe("https://sandbox-api.whop.com/oauth/authorize");
    expect(authorize.searchParams.get("redirect_uri")).toBe("https://ako.convex.site/whop/oauth/callback");
    expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
    const state = authorize.searchParams.get("state")!;

    const res = await t.fetch(`/whop/oauth/callback?code=abc&state=${state}`);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`${RETURN_URL}?whop=linked`);
    const tokenBody = JSON.parse(calls[0].body);
    expect(tokenBody).toMatchObject({ grant_type: "authorization_code", code: "abc", client_id: "app_ako" });
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tokenBody.code_verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(authorize.searchParams.get("code_challenge")).toBe(challenge);
    expect((await earnings(t))?.whop).toEqual({ userId: WHOP_USER, username: "player" });

    expect((await t.fetch(`/whop/oauth/callback?code=abc&state=${state}`)).status).toBe(400);

    await t.mutation(api.cashout.wallet.claimWallet, OTHER);
    const second = new URL(await t.mutation(api.cashout.wallet.startWhopLink, { ...OTHER, returnUrl: RETURN_URL }));
    const reused = await t.fetch(`/whop/oauth/callback?code=def&state=${second.searchParams.get("state")}`);
    expect(reused.headers.get("Location")).toContain("whop=error");
    expect(decodeURIComponent(reused.headers.get("Location")!.replace(/\+/g, " "))).toContain(
      "already linked to another Ako device",
    );
  });

  test("links by Whop username using Ako's server key", async () => {
    const t = convexTest(schema, modules);
    delete process.env.WHOP_CLIENT_ID;
    await setupPlayer(t, { linked: false });
    expect((await earnings(t))?.linkMode).toBe("username");
    mockWhop((call) =>
      call.url.endsWith("/users/player")
        ? json(200, { id: WHOP_USER, username: "player", name: "Player One" })
        : json(404, { error: { type: "not_found", message: "not found" } }),
    );
    await expect(
      t.action(api.cashout.whop.linkWhopAccount, { ...PLAYER, username: "@nobody" }),
    ).rejects.toThrow(/No Whop user is named @nobody/);
    expect(await t.action(api.cashout.whop.linkWhopAccount, { ...PLAYER, username: "@player" })).toEqual({
      username: "player",
      name: "Player One",
    });
    expect(calls.at(-1)?.headers.authorization).toBe("Bearer test_key");
    expect((await earnings(t))?.whop).toEqual({ userId: WHOP_USER, username: "player" });
    await expect(
      t.action(api.cashout.whop.linkWhopAccount, { ...PLAYER, secret: "x".repeat(48), username: "player" }),
    ).rejects.toThrow(/another device/);
  });

  test("allows configured web origins as return links", async () => {
    const t = convexTest(schema, modules);
    await setupPlayer(t, { linked: false });
    await expect(
      t.mutation(api.cashout.wallet.startWhopLink, { ...PLAYER, returnUrl: "https://ako.app/earnings" }),
    ).rejects.toThrow(/Invalid return link/);
    process.env.CASHOUT_WEB_ORIGINS = "https://ako.app";
    await t.mutation(api.cashout.wallet.startWhopLink, { ...PLAYER, returnUrl: "https://ako.app/earnings" });
    delete process.env.CASHOUT_WEB_ORIGINS;
  });

  test("refuses return links outside the app", async () => {
    const t = convexTest(schema, modules);
    await setupPlayer(t, { linked: false });
    await expect(
      t.mutation(api.cashout.wallet.startWhopLink, { ...PLAYER, returnUrl: "https://evil.example/steal" }),
    ).rejects.toThrow(/Invalid return link/);
  });
});

describe("cash-out", () => {
  test("requires a linked Whop account and the minimum", async () => {
    const t = convexTest(schema, modules);
    await setupPlayer(t, { linked: false, credits: 300 });
    await expect(
      t.mutation(api.cashout.wallet.requestCashOut, { ...PLAYER, requestId: "req-aaaaaaaaaaaaaaaa" }),
    ).rejects.toThrow(/Connect your Whop account/);
    await t.mutation(internal.cashout.wallet.completeLink, { deviceId: PLAYER.deviceId, whopUserId: WHOP_USER });
    await expect(
      t.mutation(api.cashout.wallet.requestCashOut, { ...PLAYER, requestId: "req-aaaaaaaaaaaaaaaa" }),
    ).rejects.toThrow(/minimum cash-out is \$5\.00; you have \$3\.00/);
  });

  test("double taps make one redemption and one Whop transfer, reconciled before completion", async () => {
    const t = convexTest(schema, modules);
    await setupPlayer(t, { credits: 600 });
    mockWhop(happyWhop());

    const first = await t.mutation(api.cashout.wallet.requestCashOut, { ...PLAYER, requestId: "req-bbbbbbbbbbbbbbbb" });
    const second = await t.mutation(api.cashout.wallet.requestCashOut, { ...PLAYER, requestId: "req-bbbbbbbbbbbbbbbb" });
    expect(second).toBe(first);
    await expect(
      t.mutation(api.cashout.wallet.requestCashOut, { ...PLAYER, requestId: "req-cccccccccccccccc" }),
    ).rejects.toThrow(/still processing/);
    const reserved = await earnings(t);
    expect(reserved).toMatchObject({ availableCredits: 0, pendingCredits: 600 });
    expect(reserved?.history[0].status).toBe("pending");

    await settle(t);

    expect(posts()).toHaveLength(1);
    const body = JSON.parse(posts()[0].body);
    expect(body).toMatchObject({
      type: "balance",
      origin_id: "biz_ako",
      destination_id: WHOP_USER,
      amount: 6,
      currency: "usd",
    });
    expect(posts()[0].headers["idempotency-key"]).toBe(body.idempotence_key);
    expect(posts()[0].headers.authorization).toBe("Bearer test_key");
    expect(calls.some((c) => c.method === "GET" && c.url.endsWith("/transfers/ctt_test1"))).toBe(true);

    const done = await earnings(t);
    expect(done).toMatchObject({ availableCredits: 0, pendingCredits: 0, redeemedCredits: 600, transferredCents: 600 });
    expect(done?.history[0]).toMatchObject({
      status: "transferred",
      whopTransferId: "ctt_test1",
      trackingUrl: "https://sandbox.whop.com/ctt_test1/",
    });
  });

  test("a declined transfer fails with a useful message and releases the credits", async () => {
    const t = convexTest(schema, modules);
    await setupPlayer(t, { credits: 600 });
    mockWhop(() => json(403, { error: { type: "forbidden", message: "credential lacks the required scope" } }));

    await t.mutation(api.cashout.wallet.requestCashOut, { ...PLAYER, requestId: "req-dddddddddddddddd" });
    await settle(t);

    const after = await earnings(t);
    expect(after).toMatchObject({ availableCredits: 600, pendingCredits: 0 });
    expect(after?.history[0]).toMatchObject({ status: "failed", failureReason: "Ako's Whop key is not allowed to send transfers yet." });

    mockWhop(happyWhop());
    await t.mutation(api.cashout.wallet.requestCashOut, { ...PLAYER, requestId: "req-eeeeeeeeeeeeeeee" });
    await settle(t);
    expect((await earnings(t))?.history[0].status).toBe("transferred");
  });

  test("a transfer Whop later marks failed releases the credits", async () => {
    const t = convexTest(schema, modules);
    await setupPlayer(t, { credits: 600 });
    mockWhop((call) =>
      call.method === "POST"
        ? json(201, transfer("processing"))
        : json(200, transfer("failed", { failure_reason: "Recipient cannot receive funds" })),
    );
    await t.mutation(api.cashout.wallet.requestCashOut, { ...PLAYER, requestId: "req-ffffffffffffffff" });
    await settle(t);
    const after = await earnings(t);
    expect(after?.availableCredits).toBe(600);
    expect(after?.history[0].failureReason).toContain("Recipient cannot receive funds");
  });

  test("unknown outcomes retry with the same idempotency key and identical body", async () => {
    const t = convexTest(schema, modules);
    await setupPlayer(t, { credits: 600 });
    let attempt = 0;
    mockWhop((call) => {
      if (call.method === "GET") return json(200, transfer("succeeded"));
      attempt++;
      if (attempt === 1) throw new TypeError("fetch failed");
      if (attempt === 2) {
        process.env.WHOP_COMPANY_ID = "biz_changed";
        return json(500, { error: { type: "server_error", message: "boom" } });
      }
      if (attempt === 3) return json(409, { error: { type: "conflict", code: "idempotency_request_in_progress", message: "busy" } });
      return json(201, transfer("succeeded"));
    });
    await t.mutation(api.cashout.wallet.requestCashOut, { ...PLAYER, requestId: "req-gggggggggggggggg" });
    await settle(t);

    expect(posts()).toHaveLength(4);
    expect(new Set(posts().map((p) => p.headers["idempotency-key"])).size).toBe(1);
    expect(new Set(posts().map((p) => p.body)).size).toBe(1);
    expect(JSON.parse(posts()[3].body).origin_id).toBe("biz_ako");
    expect((await earnings(t))?.history[0].status).toBe("transferred");
  });

  test("an outcome that stays unknown goes to review and never releases credits", async () => {
    const t = convexTest(schema, modules);
    await setupPlayer(t, { credits: 600 });
    mockWhop(() => json(503, { error: { type: "unavailable", message: "down" } }));
    await t.mutation(api.cashout.wallet.requestCashOut, { ...PLAYER, requestId: "req-hhhhhhhhhhhhhhhh" });
    await settle(t);

    expect(posts()).toHaveLength(5);
    const after = await earnings(t);
    expect(after).toMatchObject({ availableCredits: 0, pendingCredits: 600 });
    expect(after?.history[0]).toMatchObject({ status: "processing", needsReview: true });
    const report = await t.query(api.cashout.admin.report, { adminKey: "admin-secret" });
    expect(report.needsReview).toBe(1);
    await expect(t.query(api.cashout.admin.report, { adminKey: "wrong" })).rejects.toThrow(/Not authorized/);
  });

  test("a success to the wrong destination is held for review, not completed", async () => {
    const t = convexTest(schema, modules);
    await setupPlayer(t, { credits: 600 });
    mockWhop((call) =>
      call.method === "POST"
        ? json(201, transfer("processing"))
        : json(200, transfer("succeeded", { destination: { id: "user_someoneelse" } })),
    );
    await t.mutation(api.cashout.wallet.requestCashOut, { ...PLAYER, requestId: "req-iiiiiiiiiiiiiiii" });
    await settle(t);
    expect((await earnings(t))?.history[0]).toMatchObject({ status: "processing", needsReview: true });
  });

  test("production stays off until the live switch is set", async () => {
    const t = convexTest(schema, modules);
    await setupPlayer(t, { credits: 600 });
    process.env.WHOP_ENVIRONMENT = "production";
    expect((await earnings(t))?.mode).toBe("disabled");
    await expect(
      t.mutation(api.cashout.wallet.requestCashOut, { ...PLAYER, requestId: "req-jjjjjjjjjjjjjjjj" }),
    ).rejects.toThrow(/Live cash-outs are switched off/);

    process.env.CASHOUT_LIVE_TRANSFERS = "true";
    mockWhop(happyWhop());
    expect((await earnings(t))?.mode).toBe("live");
    await t.mutation(api.cashout.wallet.requestCashOut, { ...PLAYER, requestId: "req-kkkkkkkkkkkkkkkk" });
    await settle(t);
    expect(posts()[0].url).toBe("https://api.whop.com/api/v1/transfers");
  });
});

describe("verified rewards", () => {
  test("only a server-judged win over the standard boss earns credits, once", async () => {
    const t = convexTest(schema, modules);
    const attackFor = async (boss: typeof DEFAULT_BOSS) =>
      await t.run(async (ctx) => {
        const roomId = await ctx.db.insert("jbRooms", {
          code: `R${Math.random()}`,
          hostId: PLAYER.deviceId,
          ...boss,
          status: "active",
          round: 1,
        });
        await ctx.db.insert("jbPlayers", {
          roomId,
          playerId: PLAYER.deviceId,
          name: "knight",
          ring: 1,
          slot: 0,
          chatEpoch: 0,
          lastSeen: Date.now(),
        });
        return await ctx.db.insert("jbAttacks", {
          roomId,
          playerId: PLAYER.deviceId,
          playerName: "knight",
          clientAttackId: "a1",
          prompt: "say it",
          round: 1,
          chatEpoch: 0,
          status: "pending",
          ringBefore: 1,
        });
      });
    const win = { reply: "dragon", adapter: "test", outcome: "full" as const, label: "BROKEN" };

    const standard = await attackFor(DEFAULT_BOSS);
    await t.mutation(internal.jailbreak.engine.applyResult, { attackId: standard, ...win });
    await t.mutation(internal.jailbreak.engine.applyResult, { attackId: standard, ...win });
    const custom = await attackFor({ ...DEFAULT_BOSS, winCheck: "a" });
    await t.mutation(internal.jailbreak.engine.applyResult, { attackId: custom, ...win });

    await t.mutation(api.cashout.wallet.claimWallet, PLAYER);
    expect((await earnings(t))?.earnedCredits).toBe(100);
  });

  test("a finished Unpredictable run awards its server-computed points", async () => {
    const t = convexTest(schema, modules);
    const roundId = await t.run(async (ctx) => {
      const playerId = await ctx.db.insert("unpPlayers", { deviceId: PLAYER.deviceId, name: "p" });
      const promptId = await ctx.db.insert("unpPrompts", { set: 0, index: 0, text: "Name a fruit", common: [] });
      const sessionId = await ctx.db.insert("unpSessions", { playerId, day: "2026-11-15", set: 0, status: "ready", lives: 3 });
      return await ctx.db.insert("unpRounds", {
        sessionId,
        playerId,
        promptId,
        index: 0,
        promptText: "Name a fruit",
        guesses: ["apple", "banana", "orange"],
        reason: "",
        usedMemory: false,
        status: "judging",
        answer: "durian",
      });
    });
    await t.mutation(internal.unpredictable.game.finalizeRound, {
      roundId,
      valid: true,
      reason: "",
      matchedGuess: null,
      cluster: "durian",
    });
    await t.mutation(api.cashout.wallet.claimWallet, PLAYER);
    const result = await earnings(t);
    expect(result?.earnedCredits).toBe(175);
    expect(result?.recentRewards[0].source).toBe("unpredictable");
  });

  test("daily credit cap limits what one device can earn", async () => {
    const t = convexTest(schema, modules);
    await setupPlayer(t, { credits: 900 });
    await t.run(async (ctx) => {
      for (let i = 0; i < 300; i++) {
        await awardCredits(ctx, {
          deviceId: PLAYER.deviceId,
          source: "jailbreak",
          sourceKey: `jailbreak:extra${i}`,
          credits: 100,
          note: "extra",
        });
      }
    });
    const result = await earnings(t);
    expect(result?.availableCredits).toBe(1000);
    const rows = await t.run(async (ctx) => await ctx.db.query("cashRewards").collect());
    expect(rows).toHaveLength(2);
  });
});
