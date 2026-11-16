import { httpRouter } from "convex/server";

import { whopWebhook } from "./whop/webhook";

const http = httpRouter();

http.route({ path: "/whop/webhook", method: "POST", handler: whopWebhook });

export default http;
