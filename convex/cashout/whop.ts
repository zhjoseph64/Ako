import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action, internalAction, type ActionCtx } from "../_generated/server";
import { DEMO_ID_PREFIX, oauthRedirectUri, WHOP_API_VERSION_DATE, whopSettings } from "./config";

const SEND_RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000];
const RECONCILE_DELAYS_MS = [2_000, 5_000, 15_000, 60_000, 300_000];
const DEMO_SETTLE_MS = 3_000;

type WhopMoney = { amount: string; currency: string };
type WhopTransfer = {
  id: string;
  status: "processing" | "succeeded" | "failed";
  destination?: { id: string } | null;
  amount?: WhopMoney | null;
  fee?: WhopMoney | null;
  failure_code?: string | null;
  failure_reason?: string | null;
  tracking_url?: string;
};

function headers(apiKey: string, extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Api-Version-Date": WHOP_API_VERSION_DATE,
    ...extra,
  };
}

async function readError(res: Response) {
  const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  return { code: body?.error?.code ?? null, message: body?.error?.message ?? `HTTP ${res.status}` };
}

function declineReason(status: number, message: string) {
  if (status === 401) return "Ako's Whop connection is misconfigured.";
  if (status === 403) return "Ako's Whop key is not allowed to send transfers yet.";
  return `Whop declined the transfer: ${message}`;
}

export function transferBody(r: Doc<"cashRedemptions">) {
  return {
    type: "balance",
    origin_id: r.originId,
    destination_id: r.whopUserId,
    amount: r.netCents / 100,
    currency: r.currency,
    idempotence_key: r.idempotencyKey,
    notes: "Ako cash-out",
    metadata: { ako_redemption_id: r._id, credits: String(r.credits) },
  };
}

async function retryOrReview(ctx: ActionCtx, redemptionId: Id<"cashRedemptions">, attempt: number, reason: string): Promise<null> {
  const delay = SEND_RETRY_DELAYS_MS[attempt - 1];
  if (delay !== undefined) {
    await ctx.scheduler.runAfter(delay, internal.cashout.whop.sendTransfer, { redemptionId });
    return null;
  }
  await ctx.runMutation(internal.cashout.wallet.markNeedsReview, {
    redemptionId,
    reason: `Outcome unknown after ${attempt} attempts: ${reason}`,
  });
  return null;
}

export const sendTransfer = internalAction({
  args: { redemptionId: v.id("cashRedemptions") },
  returns: v.null(),
  handler: async (ctx, { redemptionId }): Promise<null> => {
    const r = await ctx.runQuery(internal.cashout.wallet.transferContext, { redemptionId });
    if (!r || (r.status !== "pending" && r.status !== "processing")) return null;
    if (r.whopTransferId) {
      await ctx.scheduler.runAfter(0, internal.cashout.whop.reconcileTransfer, { redemptionId });
      return null;
    }
    const settings = whopSettings();
    const reason =
      settings.disabledReason ??
      (settings.environment !== r.environment
        ? "Ako's Whop environment changed before this cash-out was sent."
        : (r.demo ?? false) !== (settings.mode === "demo")
          ? "Cash-out demo mode was switched before this cash-out was sent."
          : null);
    if (reason) {
      if (r.attempts === 0) {
        await ctx.runMutation(internal.cashout.wallet.markFailed, { redemptionId, reason });
      } else {
        await ctx.runMutation(internal.cashout.wallet.markNeedsReview, { redemptionId, reason });
      }
      return null;
    }
    const attempt: number | null = await ctx.runMutation(internal.cashout.wallet.markSending, { redemptionId });
    if (attempt === null) return null;

    if (r.demo) {
      const whopTransferId = `${DEMO_ID_PREFIX}${redemptionId}`;
      await ctx.runMutation(internal.cashout.wallet.recordTransfer, { redemptionId, whopTransferId, whopStatus: "processing" });
      await ctx.scheduler.runAfter(DEMO_SETTLE_MS, internal.cashout.wallet.markTransferred, { redemptionId, whopTransferId });
      return null;
    }

    let res: Response;
    try {
      res = await fetch(`${settings.apiBase}/transfers`, {
        method: "POST",
        headers: headers(settings.apiKey, { "Idempotency-Key": r.idempotencyKey }),
        body: JSON.stringify(transferBody(r)),
      });
    } catch (error) {
      return await retryOrReview(ctx, redemptionId, attempt, error instanceof Error ? error.message : "network error");
    }

    if (res.ok) {
      const transfer = (await res.json().catch(() => null)) as WhopTransfer | null;
      if (!transfer?.id) return await retryOrReview(ctx, redemptionId, attempt, "Whop returned no transfer id");
      await ctx.runMutation(internal.cashout.wallet.recordTransfer, {
        redemptionId,
        whopTransferId: transfer.id,
        whopStatus: transfer.status,
      });
      await ctx.scheduler.runAfter(0, internal.cashout.whop.reconcileTransfer, { redemptionId });
      return null;
    }

    const error = await readError(res);
    if (res.status === 409 || res.status === 429 || res.status >= 500) {
      return await retryOrReview(ctx, redemptionId, attempt, `${res.status} ${error.message}`);
    }
    if (error.code === "idempotency_key_mismatch") {
      await ctx.runMutation(internal.cashout.wallet.markNeedsReview, {
        redemptionId,
        reason: "Whop saw a different request under this idempotency key; check the Whop dashboard before retrying.",
      });
      return null;
    }
    await ctx.runMutation(internal.cashout.wallet.markFailed, {
      redemptionId,
      reason: declineReason(res.status, error.message),
    });
    return null;
  },
});

async function recheckLater(ctx: ActionCtx, redemptionId: Id<"cashRedemptions">, whopStatus: string, reason: string): Promise<null> {
  const checks = await ctx.runMutation(internal.cashout.wallet.markReconcileCheck, { redemptionId, whopStatus });
  const delay = RECONCILE_DELAYS_MS[checks - 1];
  if (delay !== undefined) {
    await ctx.scheduler.runAfter(delay, internal.cashout.whop.reconcileTransfer, { redemptionId });
    return null;
  }
  await ctx.runMutation(internal.cashout.wallet.markNeedsReview, { redemptionId, reason });
  return null;
}

export const reconcileTransfer = internalAction({
  args: { redemptionId: v.id("cashRedemptions") },
  returns: v.null(),
  handler: async (ctx, { redemptionId }): Promise<null> => {
    const r = await ctx.runQuery(internal.cashout.wallet.transferContext, { redemptionId });
    if (!r || r.status !== "processing" || !r.whopTransferId) return null;
    if (r.whopTransferId.startsWith(DEMO_ID_PREFIX)) return null;
    const settings = whopSettings();
    let res: Response;
    try {
      res = await fetch(`${settings.apiBase}/transfers/${encodeURIComponent(r.whopTransferId)}`, {
        headers: headers(settings.apiKey),
      });
    } catch {
      return await recheckLater(ctx, redemptionId, "unknown", "Could not reach Whop to confirm the transfer.");
    }
    if (!res.ok) {
      const error = await readError(res);
      return await recheckLater(ctx, redemptionId, "unknown", `Whop lookup failed: ${res.status} ${error.message}`);
    }
    const transfer = (await res.json()) as WhopTransfer;
    if (transfer.id !== r.whopTransferId) {
      await ctx.runMutation(internal.cashout.wallet.markNeedsReview, { redemptionId, reason: "Whop returned a different transfer." });
      return null;
    }
    if (transfer.status === "succeeded") {
      if (transfer.destination?.id !== r.whopUserId) {
        await ctx.runMutation(internal.cashout.wallet.markNeedsReview, {
          redemptionId,
          reason: `Transfer succeeded but went to ${transfer.destination?.id ?? "an unknown destination"}.`,
        });
        return null;
      }
      await ctx.runMutation(internal.cashout.wallet.markTransferred, {
        redemptionId,
        whopTransferId: transfer.id,
        whopFee: transfer.fee ? `${transfer.fee.amount} ${transfer.fee.currency}` : undefined,
        trackingUrl: transfer.tracking_url,
      });
      return null;
    }
    if (transfer.status === "failed") {
      await ctx.runMutation(internal.cashout.wallet.markFailed, {
        redemptionId,
        whopStatus: "failed",
        reason: `Whop could not complete the transfer: ${transfer.failure_reason ?? transfer.failure_code ?? "no reason given"}.`,
      });
      return null;
    }
    return await recheckLater(ctx, redemptionId, transfer.status, "Whop still reports the transfer as processing.");
  },
});

export const recheck = internalAction({
  args: { redemptionId: v.id("cashRedemptions") },
  returns: v.null(),
  handler: async (ctx, { redemptionId }): Promise<null> => {
    const r = await ctx.runQuery(internal.cashout.wallet.transferContext, { redemptionId });
    if (!r) return null;
    if (r.whopTransferId?.startsWith(DEMO_ID_PREFIX)) {
      await ctx.scheduler.runAfter(0, internal.cashout.wallet.markTransferred, {
        redemptionId,
        whopTransferId: r.whopTransferId,
      });
      return null;
    }
    await ctx.scheduler.runAfter(
      0,
      r.whopTransferId ? internal.cashout.whop.reconcileTransfer : internal.cashout.whop.sendTransfer,
      { redemptionId },
    );
    return null;
  },
});

export const linkWhopAccount = action({
  args: { deviceId: v.string(), secret: v.string(), username: v.string() },
  returns: v.object({ username: v.string(), name: v.union(v.string(), v.null()) }),
  handler: async (ctx, args): Promise<{ username: string; name: string | null }> => {
    const handle = args.username.trim().replace(/^@/, "");
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(handle)) throw new ConvexError("Enter your Whop username.");
    const deviceId: string = await ctx.runQuery(internal.cashout.wallet.walletForLink, {
      deviceId: args.deviceId,
      secret: args.secret,
    });
    const settings = whopSettings();
    if (!settings.apiKey && settings.mode === "demo") {
      const problem: string | null = await ctx.runMutation(internal.cashout.wallet.completeLink, {
        deviceId,
        whopUserId: `${DEMO_ID_PREFIX}user_${handle.toLowerCase()}`,
        whopUsername: handle,
      });
      if (problem) throw new ConvexError(problem);
      return { username: handle, name: null };
    }
    if (!settings.apiKey) throw new ConvexError("Cash-outs are not set up yet.");
    const res = await fetch(`${settings.apiBase}/users/${encodeURIComponent(handle)}`, {
      headers: headers(settings.apiKey),
    }).catch(() => null);
    if (res?.status === 404) throw new ConvexError(`No Whop user is named @${handle}.`);
    if (!res?.ok) throw new ConvexError("Couldn't reach Whop. Try again.");
    const user = (await res.json()) as { id?: string; username?: string; name?: string | null };
    if (!user.id?.startsWith("user_")) throw new ConvexError(`No Whop user is named @${handle}.`);
    const username = user.username ?? handle;
    const problem: string | null = await ctx.runMutation(internal.cashout.wallet.completeLink, {
      deviceId,
      whopUserId: user.id,
      whopUsername: username,
    });
    if (problem) throw new ConvexError(problem);
    return { username, name: user.name ?? null };
  },
});

export const checkSetup = internalAction({
  args: {},
  handler: async () => {
    const settings = whopSettings();
    const report: Record<string, unknown> = {
      environment: settings.environment,
      mode: settings.mode,
      disabledReason: settings.disabledReason,
      linkMode: settings.linkingEnabled ? "oauth" : "username",
      hasClientSecret: settings.clientSecret !== "",
      redirectUri: oauthRedirectUri(),
      transferFundsPermission: "not testable without moving money; confirm payout:transfer_funds on the key",
    };
    if (settings.mode === "demo") {
      report.demo = "Demo mode: cash-outs are simulated and no real transfers are made. Remove CASHOUT_DEMO to send real sandbox transfers.";
    }
    if (!settings.apiKey) return report;
    const account = await fetch(`${settings.apiBase}/accounts/me`, { headers: headers(settings.apiKey) });
    if (account.ok) {
      const body = (await account.json()) as {
        id: string;
        status: string | null;
        verification: unknown;
        balances: unknown;
        capabilities: unknown;
      };
      report.account = {
        id: body.id,
        matchesCompanyId: body.id === settings.companyId,
        status: body.status,
        verification: body.verification,
        balances: body.balances,
        capabilities: body.capabilities,
      };
    } else {
      report.account = { error: `${account.status} ${(await readError(account)).message}`, needs: "company:balance:read" };
    }
    const transfers = await fetch(`${settings.apiBase}/transfers?first=1`, { headers: headers(settings.apiKey) });
    report.transferRead = transfers.ok
      ? "ok"
      : { error: `${transfers.status} ${(await readError(transfers)).message}`, needs: "payout:transfer:read" };
    return report;
  },
});
