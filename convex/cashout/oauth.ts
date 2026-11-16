import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import { oauthRedirectUri, whopSettings } from "./config";

function backToApp(returnUrl: string, params: Record<string, string>) {
  const separator = returnUrl.includes("?") ? "&" : "?";
  return new Response(null, {
    status: 302,
    headers: { Location: `${returnUrl}${separator}${new URLSearchParams(params)}` },
  });
}

export const whopOAuthCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const session = state ? await ctx.runMutation(internal.cashout.wallet.consumeLinkSession, { state }) : null;
  if (!session) {
    return new Response("This Whop link has expired. Go back to Ako and tap Connect Whop again.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const fail = (message: string) => backToApp(session.returnUrl, { whop: "error", message });
  if (url.searchParams.get("error") || !code) return fail("Whop sign-in was cancelled.");

  const settings = whopSettings();
  const token = await fetch(`${settings.oauthBase}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: oauthRedirectUri(),
      client_id: settings.clientId,
      code_verifier: session.codeVerifier,
      ...(settings.clientSecret ? { client_secret: settings.clientSecret } : {}),
    }),
  }).catch(() => null);
  if (!token?.ok) return fail("Whop sign-in failed. Try again.");
  const { access_token } = (await token.json()) as { access_token?: string };
  if (!access_token) return fail("Whop sign-in failed. Try again.");

  const info = await fetch(`${settings.oauthBase}/userinfo`, {
    headers: { Authorization: `Bearer ${access_token}` },
  }).catch(() => null);
  if (!info?.ok) return fail("Could not read your Whop profile.");
  const user = (await info.json()) as { sub?: string; preferred_username?: string; name?: string };
  if (!user.sub?.startsWith("user_")) return fail("Could not read your Whop profile.");

  const problem = await ctx.runMutation(internal.cashout.wallet.completeLink, {
    deviceId: session.deviceId,
    whopUserId: user.sub,
    whopUsername: user.preferred_username ?? user.name,
  });
  return problem ? fail(problem) : backToApp(session.returnUrl, { whop: "linked" });
});
