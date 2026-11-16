import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { CASHOUT_RULES, oauthRedirectUri, whopSettings } from "./config";

const walletArgs = { deviceId: v.string(), secret: v.string() };
const NATIVE_RETURN_SCHEMES = ["ycapp:", "exp:", "exps:"];

function allowedReturnUrl(returnUrl: string) {
  let url: URL;
  try {
    url = new URL(returnUrl);
  } catch {
    return false;
  }
  if (NATIVE_RETURN_SCHEMES.includes(url.protocol)) return true;
  if (url.hostname === "localhost" && (url.protocol === "http:" || url.protocol === "https:")) return true;
  const webOrigins = (process.env.CASHOUT_WEB_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  return url.protocol === "https:" && webOrigins.includes(url.origin);
}

function fail(message: string): never {
  throw new ConvexError(message);
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(byteCount: number) {
  return base64url(crypto.getRandomValues(new Uint8Array(byteCount)));
}

async function sha256(text: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

async function hashSecret(secret: string) {
  return [...(await sha256(secret))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function findWallet(ctx: QueryCtx, { deviceId, secret }: { deviceId: string; secret: string }) {
  const wallet = await ctx.db
    .query("cashWallets")
    .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
    .unique();
  if (!wallet) return null;
  if (wallet.secretHash !== (await hashSecret(secret))) fail("This wallet belongs to another device.");
  return wallet;
}

async function requireWallet(ctx: QueryCtx, creds: { deviceId: string; secret: string }) {
  const wallet = await findWallet(ctx, creds);
  if (!wallet) fail("Open Earnings once on this device to set up your wallet.");
  return wallet;
}

async function logEvent(ctx: MutationCtx, redemptionId: Id<"cashRedemptions">, type: string, detail: string) {
  await ctx.db.insert("cashEvents", { redemptionId, type, detail });
}

async function ownsGameIdentity(ctx: QueryCtx, { deviceId, secret }: { deviceId: string; secret: string }) {
  const profile = await ctx.db
    .query("platProfiles")
    .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
    .unique();
  if (profile?.secret !== undefined && profile.secret !== secret) return false;
  const knights = await ctx.db
    .query("jbPlayers")
    .withIndex("by_playerId", (q) => q.eq("playerId", deviceId))
    .take(200);
  return knights.every((knight) => knight.secret === undefined || knight.secret === secret);
}

export const claimWallet = mutation({
  args: walletArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.deviceId.length < 8 || args.secret.length < 32) fail("Invalid device credentials.");
    if (await findWallet(ctx, args)) return null;
    if (!(await ownsGameIdentity(ctx, args))) fail("This player belongs to another device.");
    await ctx.db.insert("cashWallets", { deviceId: args.deviceId, secretHash: await hashSecret(args.secret) });
    return null;
  },
});

async function availableRewards(ctx: QueryCtx, deviceId: string) {
  const rewards = await ctx.db
    .query("cashRewards")
    .withIndex("by_deviceId_and_status", (q) => q.eq("deviceId", deviceId).eq("status", "available"))
    .take(CASHOUT_RULES.maxRewardsPerCashOut);
  return { rewards, credits: rewards.reduce((sum, r) => sum + r.credits, 0) };
}

function publicRedemption(r: Doc<"cashRedemptions">) {
  return {
    _id: r._id,
    requestedAt: r._creationTime,
    credits: r.credits,
    centsPerCredit: r.centsPerCredit,
    netCents: r.netCents,
    feeCents: r.feeCents,
    status: r.status,
    needsReview: r.needsReview,
    environment: r.environment,
    whopUsername: r.whopUsername ?? null,
    whopTransferId: r.whopTransferId ?? null,
    trackingUrl: r.whopTrackingUrl ?? null,
    failureReason: r.failureReason ?? null,
    settledAt: r.settledAt ?? null,
  };
}

export const earnings = query({
  args: walletArgs,
  handler: async (ctx, args) => {
    const wallet = await findWallet(ctx, args);
    if (!wallet) return null;
    const settings = whopSettings();
    const rewards = await ctx.db
      .query("cashRewards")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .take(1000);
    const total = (status?: Doc<"cashRewards">["status"]) =>
      rewards.filter((r) => !status || r.status === status).reduce((sum, r) => sum + r.credits, 0);
    const redemptions = await ctx.db
      .query("cashRedemptions")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .take(25);
    const { credits: availableCredits } = await availableRewards(ctx, args.deviceId);
    const grossCents = availableCredits * CASHOUT_RULES.centsPerCredit;
    return {
      earnedCredits: total(),
      availableCredits,
      pendingCredits: total("reserved"),
      redeemedCredits: total("redeemed"),
      availableCents: grossCents,
      cashOutNetCents: Math.max(0, grossCents - CASHOUT_RULES.akoFeeCents),
      transferredCents: redemptions.filter((r) => r.status === "transferred").reduce((s, r) => s + r.netCents, 0),
      inFlight: redemptions.some((r) => r.status === "pending" || r.status === "processing"),
      rules: {
        centsPerCredit: CASHOUT_RULES.centsPerCredit,
        minimumCents: CASHOUT_RULES.minimumCents,
        feeCents: CASHOUT_RULES.akoFeeCents,
        dailyCreditCap: CASHOUT_RULES.dailyCreditCap,
        currency: CASHOUT_RULES.currency,
      },
      mode: settings.mode,
      environment: settings.environment,
      disabledReason: settings.disabledReason,
      linkMode: settings.linkingEnabled ? ("oauth" as const) : settings.apiKey ? ("username" as const) : null,
      whopWebBase: settings.webBase,
      whop: wallet.whopUserId ? { userId: wallet.whopUserId, username: wallet.whopUsername ?? null } : null,
      recentRewards: rewards.slice(0, 8).map((r) => ({
        _id: r._id,
        at: r._creationTime,
        source: r.source,
        credits: r.credits,
        note: r.note,
        status: r.status,
      })),
      history: redemptions.map(publicRedemption),
    };
  },
});

export const startWhopLink = mutation({
  args: { ...walletArgs, returnUrl: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const wallet = await requireWallet(ctx, args);
    const settings = whopSettings();
    if (!settings.linkingEnabled) fail("Connecting Whop is not set up yet.");
    if (!allowedReturnUrl(args.returnUrl)) fail("Invalid return link.");
    const codeVerifier = randomToken(32);
    const state = randomToken(16);
    await ctx.db.insert("cashLinkSessions", {
      deviceId: wallet.deviceId,
      state,
      codeVerifier,
      returnUrl: args.returnUrl,
      expiresAt: Date.now() + CASHOUT_RULES.linkSessionMs,
    });
    const params = new URLSearchParams({
      response_type: "code",
      client_id: settings.clientId,
      redirect_uri: oauthRedirectUri(),
      scope: "openid profile",
      state,
      nonce: randomToken(16),
      code_challenge: base64url(await sha256(codeVerifier)),
      code_challenge_method: "S256",
    });
    return `${settings.oauthBase}/authorize?${params}`;
  },
});

export const walletForLink = internalQuery({
  args: walletArgs,
  returns: v.string(),
  handler: async (ctx, args) => {
    const wallet = await requireWallet(ctx, args);
    return wallet.deviceId;
  },
});

export const consumeLinkSession = internalMutation({
  args: { state: v.string() },
  returns: v.union(v.null(), v.object({ deviceId: v.string(), codeVerifier: v.string(), returnUrl: v.string() })),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("cashLinkSessions")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .unique();
    if (!session || session.usedAt !== undefined || session.expiresAt < Date.now()) return null;
    await ctx.db.patch("cashLinkSessions", session._id, { usedAt: Date.now() });
    return { deviceId: session.deviceId, codeVerifier: session.codeVerifier, returnUrl: session.returnUrl };
  },
});

export const completeLink = internalMutation({
  args: { deviceId: v.string(), whopUserId: v.string(), whopUsername: v.optional(v.string()) },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    const wallet = await ctx.db
      .query("cashWallets")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
      .unique();
    if (!wallet) return "This Ako wallet no longer exists.";
    const owner = await ctx.db
      .query("cashWallets")
      .withIndex("by_whopUserId", (q) => q.eq("whopUserId", args.whopUserId))
      .first();
    if (owner && owner._id !== wallet._id) return "That Whop account is already linked to another Ako device.";
    if (wallet.whopUserId && wallet.whopUserId !== args.whopUserId) {
      const inFlight = await inFlightRedemption(ctx, wallet.deviceId);
      if (inFlight) return "Wait for your current cash-out to finish before switching Whop accounts.";
    }
    await ctx.db.patch("cashWallets", wallet._id, {
      whopUserId: args.whopUserId,
      whopUsername: args.whopUsername,
      linkedAt: Date.now(),
    });
    return null;
  },
});

async function inFlightRedemption(ctx: QueryCtx, deviceId: string) {
  for (const status of ["pending", "processing"] as const) {
    const found = await ctx.db
      .query("cashRedemptions")
      .withIndex("by_deviceId_and_status", (q) => q.eq("deviceId", deviceId).eq("status", status))
      .first();
    if (found) return found;
  }
  return null;
}

export const requestCashOut = mutation({
  args: { ...walletArgs, requestId: v.string() },
  returns: v.id("cashRedemptions"),
  handler: async (ctx, args) => {
    const wallet = await requireWallet(ctx, args);
    if (!/^[A-Za-z0-9-]{16,64}$/.test(args.requestId)) fail("Invalid cash-out request.");
    const idempotencyKey = `ako-cashout-${wallet._id}-${args.requestId}`;
    const repeat = await ctx.db
      .query("cashRedemptions")
      .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
      .unique();
    if (repeat) return repeat._id;

    const settings = whopSettings();
    if (settings.mode === "disabled") fail(settings.disabledReason ?? "Cash-outs are switched off.");
    if (!wallet.whopUserId) fail("Connect your Whop account before cashing out.");
    if (await inFlightRedemption(ctx, wallet.deviceId)) fail("Your last cash-out is still processing. Wait for it to finish.");

    const { rewards, credits } = await availableRewards(ctx, wallet.deviceId);
    const grossCents = credits * CASHOUT_RULES.centsPerCredit;
    const netCents = grossCents - CASHOUT_RULES.akoFeeCents;
    if (netCents < CASHOUT_RULES.minimumCents) {
      const minimum = (CASHOUT_RULES.minimumCents / 100).toFixed(2);
      fail(`Not enough credits yet. The minimum cash-out is $${minimum}; you have $${(grossCents / 100).toFixed(2)}.`);
    }

    const redemptionId = await ctx.db.insert("cashRedemptions", {
      deviceId: wallet.deviceId,
      whopUserId: wallet.whopUserId,
      whopUsername: wallet.whopUsername,
      environment: settings.environment,
      credits,
      centsPerCredit: CASHOUT_RULES.centsPerCredit,
      grossCents,
      feeCents: CASHOUT_RULES.akoFeeCents,
      netCents,
      currency: CASHOUT_RULES.currency,
      originId: settings.companyId,
      idempotencyKey,
      status: "pending",
      needsReview: false,
      attempts: 0,
      reconcileChecks: 0,
    });
    for (const reward of rewards) {
      await ctx.db.patch("cashRewards", reward._id, { status: "reserved", redemptionId });
    }
    await logEvent(ctx, redemptionId, "requested", `${credits} credits reserved for $${(netCents / 100).toFixed(2)}`);
    await ctx.scheduler.runAfter(0, internal.cashout.whop.sendTransfer, { redemptionId });
    return redemptionId;
  },
});

export const transferContext = internalQuery({
  args: { redemptionId: v.id("cashRedemptions") },
  handler: async (ctx, args) => await ctx.db.get("cashRedemptions", args.redemptionId),
});

export const markSending = internalMutation({
  args: { redemptionId: v.id("cashRedemptions") },
  returns: v.union(v.null(), v.number()),
  handler: async (ctx, args) => {
    const r = await ctx.db.get("cashRedemptions", args.redemptionId);
    if (!r || (r.status !== "pending" && r.status !== "processing") || r.whopTransferId) return null;
    const attempts = r.attempts + 1;
    await ctx.db.patch("cashRedemptions", r._id, { status: "processing", attempts });
    await logEvent(ctx, r._id, "send_attempt", `Attempt ${attempts}`);
    return attempts;
  },
});

export const recordTransfer = internalMutation({
  args: { redemptionId: v.id("cashRedemptions"), whopTransferId: v.string(), whopStatus: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const r = await ctx.db.get("cashRedemptions", args.redemptionId);
    if (!r || r.status !== "processing") return null;
    await ctx.db.patch("cashRedemptions", r._id, { whopTransferId: args.whopTransferId, whopStatus: args.whopStatus });
    await logEvent(ctx, r._id, "whop_transfer_created", `${args.whopTransferId} is ${args.whopStatus}`);
    return null;
  },
});

export const markReconcileCheck = internalMutation({
  args: { redemptionId: v.id("cashRedemptions"), whopStatus: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const r = await ctx.db.get("cashRedemptions", args.redemptionId);
    if (!r) return 0;
    const reconcileChecks = r.reconcileChecks + 1;
    await ctx.db.patch("cashRedemptions", r._id, { reconcileChecks, whopStatus: args.whopStatus });
    return reconcileChecks;
  },
});

export const markTransferred = internalMutation({
  args: {
    redemptionId: v.id("cashRedemptions"),
    whopTransferId: v.string(),
    whopFee: v.optional(v.string()),
    trackingUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const r = await ctx.db.get("cashRedemptions", args.redemptionId);
    if (!r || r.status !== "processing" || r.whopTransferId !== args.whopTransferId) return null;
    await ctx.db.patch("cashRedemptions", r._id, {
      status: "transferred",
      needsReview: false,
      whopStatus: "succeeded",
      whopFee: args.whopFee,
      whopTrackingUrl: args.trackingUrl,
      settledAt: Date.now(),
    });
    for await (const reward of ctx.db
      .query("cashRewards")
      .withIndex("by_redemptionId", (q) => q.eq("redemptionId", r._id))) {
      await ctx.db.patch("cashRewards", reward._id, { status: "redeemed" });
    }
    await logEvent(ctx, r._id, "transferred", `Whop confirmed ${args.whopTransferId} succeeded`);
    return null;
  },
});

export const markFailed = internalMutation({
  args: { redemptionId: v.id("cashRedemptions"), reason: v.string(), whopStatus: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const r = await ctx.db.get("cashRedemptions", args.redemptionId);
    if (!r || (r.status !== "pending" && r.status !== "processing")) return null;
    await ctx.db.patch("cashRedemptions", r._id, {
      status: "failed",
      needsReview: false,
      failureReason: args.reason,
      whopStatus: args.whopStatus ?? r.whopStatus,
      settledAt: Date.now(),
    });
    for await (const reward of ctx.db
      .query("cashRewards")
      .withIndex("by_redemptionId", (q) => q.eq("redemptionId", r._id))) {
      await ctx.db.patch("cashRewards", reward._id, { status: "available", redemptionId: undefined });
    }
    await logEvent(ctx, r._id, "failed", `${args.reason} Credits released.`);
    return null;
  },
});

export const markNeedsReview = internalMutation({
  args: { redemptionId: v.id("cashRedemptions"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const r = await ctx.db.get("cashRedemptions", args.redemptionId);
    if (!r || r.status !== "processing") return null;
    await ctx.db.patch("cashRedemptions", r._id, { needsReview: true });
    await logEvent(ctx, r._id, "needs_review", args.reason);
    return null;
  },
});
