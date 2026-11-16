import { httpRouter } from "convex/server";

import { whopOAuthCallback } from "./cashout/oauth";

const http = httpRouter();

http.route({ path: "/whop/oauth/callback", method: "GET", handler: whopOAuthCallback });

export default http;
