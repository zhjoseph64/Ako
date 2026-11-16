import { v } from "convex/values";

import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { TOKEN_PACK } from "./pack";

export const start = action({
  args: { deviceId: v.string(), secret: v.string(), returnUrl: v.optional(v.string()) },
  returns: v.string(),
  handler: async (ctx, args) => {
    const apiKey = process.env.WHOP_API_KEY;
    if (!apiKey) throw new Error("Whop is not configured yet");
    const owns: boolean = await ctx.runQuery(internal.whop.credit.ownsProfile, {
      deviceId: args.deviceId,
      secret: args.secret,
    });
    if (!owns) throw new Error("This profile belongs to another device");

    const host = process.env.WHOP_ENVIRONMENT === "production" ? "api.whop.com" : "sandbox-api.whop.com";
    const planId = process.env.WHOP_PLAN_ID;
    const response = await fetch(`https://${host}/api/v1/checkout_configurations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Api-Version-Date": "2026-11-04-1",
      },
      body: JSON.stringify({
        ...(process.env.WHOP_COMPANY_ID ? { account_id: process.env.WHOP_COMPANY_ID } : {}),
        ...(planId
          ? { variant_id: planId }
          : {
              variant: {
                title: TOKEN_PACK.title,
                billing_type: "one_time",
                initial_price: TOKEN_PACK.priceUsd,
                currency: "usd",
              },
            }),
        metadata: { ako_device_id: args.deviceId, ako_pack: TOKEN_PACK.id },
        ...(args.returnUrl?.startsWith("https://") || args.returnUrl?.startsWith("http://localhost")
          ? { redirect_url: args.returnUrl }
          : {}),
      }),
    });
    if (!response.ok) {
      console.error("Whop checkout failed", response.status, await response.text());
      throw new Error("Could not start checkout");
    }
    const checkout: unknown = await response.json();
    const url = (checkout as { purchase_url?: unknown }).purchase_url;
    if (typeof url !== "string") throw new Error("Could not start checkout");
    return url;
  },
});
