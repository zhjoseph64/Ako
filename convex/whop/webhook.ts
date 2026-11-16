import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";

const TOLERANCE_SECONDS = 300;

async function signatureIsValid(secret: string, id: string, timestamp: string, body: string, header: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "verify",
  ]);
  const signed = encoder.encode(`${id}.${timestamp}.${body}`);
  for (const candidate of header.split(" ")) {
    const [version, signature] = candidate.split(",");
    if (version !== "v1" || !signature) continue;
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      bytes = Uint8Array.from(atob(signature), (char) => char.charCodeAt(0));
    } catch {
      continue;
    }
    if (await crypto.subtle.verify("HMAC", key, bytes, signed)) return true;
  }
  return false;
}

export const whopWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook secret is not configured", { status: 503 });

  const id = request.headers.get("webhook-id");
  const timestamp = request.headers.get("webhook-timestamp");
  const signature = request.headers.get("webhook-signature");
  const body = await request.text();
  if (!id || !timestamp || !signature) return new Response("Missing signature headers", { status: 400 });
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!(age <= TOLERANCE_SECONDS)) return new Response("Stale timestamp", { status: 400 });
  if (!(await signatureIsValid(secret, id, timestamp, body, signature))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const { type, data } = (event ?? {}) as { type?: unknown; data?: unknown };
  if (type !== "payment.succeeded") return new Response("ignored");
  const payment = (data ?? {}) as { id?: unknown; metadata?: unknown };
  const metadata = (payment.metadata ?? {}) as { ako_device_id?: unknown; ako_pack?: unknown };
  if (typeof payment.id !== "string") return new Response("Missing payment id", { status: 400 });
  if (typeof metadata.ako_device_id !== "string" || typeof metadata.ako_pack !== "string") {
    return new Response("ignored");
  }

  const result = await ctx.runMutation(internal.whop.credit.creditPayment, {
    paymentId: payment.id,
    deviceId: metadata.ako_device_id,
    pack: metadata.ako_pack,
  });
  if (result !== "credited" && result !== "duplicate") console.error("Whop payment not credited", payment.id, result);
  return new Response(result);
});
