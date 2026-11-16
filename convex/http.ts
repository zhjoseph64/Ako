import { httpRouter } from "convex/server";

import { whopOAuthCallback } from "./cashout/oauth";
import { whopWebhook } from "./whop/webhook";

const http = httpRouter();

http.route({ path: "/whop/webhook", method: "POST", handler: whopWebhook });
http.route({ path: "/whop/oauth/callback", method: "GET", handler: whopOAuthCallback });

export default http;
