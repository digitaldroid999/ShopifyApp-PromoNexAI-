/**
 * Mandatory compliance webhooks: customers/data_request, customers/redact, shop/redact.
 * Uses raw body + HMAC verification so verification works even when body is not consumed by the framework.
 * @see https://shopify.dev/docs/apps/build/privacy-law-compliance
 */

import type { ActionFunctionArgs } from "react-router";
import { verifyShopifyWebhookHmac } from "../lib/verify-webhook-hmac.server";
import { handleComplianceWebhook } from "../lib/compliance-webhooks.server";

const LOG = "[webhooks.compliance]";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Read raw body once for HMAC verification (must not be parsed before this).
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (err) {
    console.error(`${LOG} failed to read body:`, err);
    return new Response("Bad request", { status: 400 });
  }

  const hmacHeader = request.headers.get("X-Shopify-Hmac-SHA256");
  if (!verifyShopifyWebhookHmac(rawBody, hmacHeader)) {
    console.warn(`${LOG} HMAC verification failed`);
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    console.warn(`${LOG} invalid JSON body`);
    return new Response("Bad request", { status: 400 });
  }

  const topic = request.headers.get("X-Shopify-Topic") ?? "";
  const shopDomain = (payload as { shop_domain?: string }).shop_domain;
  const shop = typeof shopDomain === "string" ? shopDomain : "";

  if (!shop) {
    console.warn(`${LOG} missing shop_domain topic=${topic}`);
    return new Response("Bad request", { status: 400 });
  }

  console.log(`${LOG} received topic=${topic} shop=${shop}`);

  try {
    await handleComplianceWebhook(topic, payload, shop);
  } catch (err) {
    console.error(`${LOG} handler error topic=${topic} shop=${shop}:`, err);
    return new Response("Internal error", { status: 500 });
  }

  return new Response(undefined, { status: 200 });
};
