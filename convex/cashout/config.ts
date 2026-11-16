export const CASHOUT_RULES = {
  centsPerCredit: 1,
  minimumCents: 500,
  akoFeeCents: 0,
  currency: "usd",
  dailyCreditCap: 1000,
  maxRewardsPerCashOut: 500,
  linkSessionMs: 10 * 60 * 1000,
} as const;

export const CREDIT_REWARDS = {
  jailbreakBossDefeated: 100,
  unpredictableCreditsPerPoint: 1,
} as const;

export const WHOP_API_VERSION_DATE = "2026-11-14-1";

export type CashOutMode = "sandbox" | "live" | "disabled" | "demo";

export function whopSettings() {
  const production = process.env.WHOP_ENVIRONMENT === "production";
  const liveSwitch = process.env.CASHOUT_LIVE_TRANSFERS === "true";
  const apiKey = process.env.WHOP_API_KEY ?? "";
  const companyId = process.env.WHOP_COMPANY_ID ?? "";
  const clientId = process.env.WHOP_CLIENT_ID ?? "";
  const missing = !apiKey || !companyId;
  const demo = !production && process.env.CASHOUT_DEMO === "true";
  const mode: CashOutMode = demo
    ? "demo"
    : missing
      ? "disabled"
      : production
        ? liveSwitch
          ? "live"
          : "disabled"
        : "sandbox";
  const disabledReason =
    mode !== "disabled"
      ? null
      : missing
        ? "Cash-outs are not set up yet: Ako's Whop credentials are missing."
        : "Live cash-outs are switched off until Ako's payout setup is confirmed.";
  return {
    environment: production ? ("production" as const) : ("sandbox" as const),
    mode,
    disabledReason,
    apiKey,
    companyId,
    clientId,
    clientSecret: process.env.WHOP_CLIENT_SECRET ?? "",
    linkingEnabled: clientId !== "",
    apiBase: production ? "https://api.whop.com/api/v1" : "https://sandbox-api.whop.com/api/v1",
    oauthBase: production ? "https://api.whop.com/oauth" : "https://sandbox-api.whop.com/oauth",
    webBase: production ? "https://whop.com" : "https://sandbox.whop.com",
  };
}

export function oauthRedirectUri() {
  return `${process.env.CONVEX_SITE_URL}/whop/oauth/callback`;
}
